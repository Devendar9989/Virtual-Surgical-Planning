"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

const API = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Chunk size: 32 MB — large enough for few round-trips, small enough for progress granularity
const CHUNK_SIZE = 32 * 1024 * 1024;
// Max parallel chunk uploads at once
const CONCURRENCY = 3;

interface UploadState {
  progress: number;
  status: "idle" | "uploading" | "queued" | "error";
  error?: string;
}

// ── Helper: upload one chunk via XHR for progress tracking ───────────────────
async function uploadChunk(
  jobId: string,
  chunkIndex: number,
  offset: number,
  blob: Blob,
  onProgress: (loadedBytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", blob, "chunk");

    const url = new URL(`${API()}/api/upload/chunk`);
    url.searchParams.set("job_id", jobId);
    url.searchParams.set("chunk_index", String(chunkIndex));
    url.searchParams.set("chunk_offset", String(offset));

    const xhr = new XMLHttpRequest();
    xhr.timeout = 0;
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(blob.size); // ensure it marks 100% bounds
        resolve();
      } else {
        const err = xhr.response as { detail?: string } | null;
        reject(new Error(err?.detail ?? `Chunk ${chunkIndex} failed`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Chunk upload timed out"));

    xhr.open("POST", url.toString());
    xhr.send(fd);
  });
}

// ── Helper: run N promises with bounded concurrency ──────────────────────────
async function pool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onDone?: () => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
      onDone?.();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useSegmentation() {
  const router = useRouter();
  const qc = useQueryClient();
  const [uploadState, setUploadState] = useState<UploadState>({
    progress: 0,
    status: "idle",
  });

  const mutation = useMutation({
    mutationFn: async ({ file, fast }: { file: File; fast: boolean }) => {
      setUploadState({ progress: 0, status: "uploading" });

      // ── Step 1: init ──────────────────────────────────────────────
      const initUrl = new URL(`${API()}/api/upload/init`);
      initUrl.searchParams.set("filename", file.name);
      initUrl.searchParams.set("file_size", String(file.size));
      if (fast) initUrl.searchParams.set("fast", "true");

      const initRes = await fetch(initUrl.toString(), { method: "POST" });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Failed to init upload");
      }
      const { job_id: jobId } = (await initRes.json()) as { job_id: string };

      // ── Step 2: slice + upload chunks in parallel ─────────────────
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const chunkProgress = new Array(totalChunks).fill(0);

      const tasks = Array.from({ length: totalChunks }, (_, i) => {
        const offset = i * CHUNK_SIZE;
        const blob = file.slice(offset, offset + CHUNK_SIZE);
        return () =>
          uploadChunk(jobId, i, offset, blob, (loaded) => {
            chunkProgress[i] = loaded;
            const totalLoaded = chunkProgress.reduce((a, b) => a + b, 0);
            // progress: 0–90% during upload, last 10% for finalize
            setUploadState({
              progress: Math.round((totalLoaded / file.size) * 90),
              status: "uploading",
            });
          });
      });

      await pool(tasks, CONCURRENCY);

      // ── Step 3: finalize ─────────────────────────────────────────
      setUploadState({ progress: 95, status: "uploading" });
      const finalUrl = new URL(`${API()}/api/upload/finalize`);
      finalUrl.searchParams.set("job_id", jobId);
      if (fast) finalUrl.searchParams.set("fast", "true");

      const finalRes = await fetch(finalUrl.toString(), { method: "POST" });
      if (!finalRes.ok) {
        const err = await finalRes.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Finalize failed");
      }

      return (await finalRes.json()) as { job_id: string; status: string };
    },

    onSuccess: (data) => {
      setUploadState({ progress: 100, status: "queued" });
      qc.invalidateQueries({ queryKey: ["job", data.job_id] });
      setTimeout(() => router.push(`/job/${data.job_id}`), 500);
    },

    onError: (err: Error) => {
      setUploadState({ progress: 0, status: "error", error: err.message });
    },
  });

  return {
    uploadState,
    upload: mutation.mutate,
    isUploading: mutation.isPending,
    reset: () => {
      setUploadState({ progress: 0, status: "idle" });
      mutation.reset();
    },
  };
}

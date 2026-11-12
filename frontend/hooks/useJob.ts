"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, JobStatus, JobResults } from "@/lib/api";
import { WS_BASE, JOB_STEPS, STEP_PROGRESS_MAP } from "@/lib/constants";
import type { Step } from "@/components/ui/StepTimeline";

export interface JobState {
  job: JobStatus | undefined;
  results: JobResults | undefined;
  steps: Step[];
  logLines: string[];
  isLoading: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  wsConnected: boolean;
}

export function useJob(jobId: string): JobState {
  const [wsData, setWsData] = useState<Partial<JobStatus> | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId),
    refetchInterval: (q) => {
      const s = (q.state.data as JobStatus | undefined)?.status;
      return s === "completed" || s === "failed" ? false : 2000;
    },
    enabled: !!jobId,
  });

  // Merge WS real-time data
  const merged: JobStatus | undefined = job
    ? { ...job, ...(wsData ?? {}) }
    : undefined;

  const { data: results } = useQuery({
    queryKey: ["results", jobId],
    queryFn: () => api.getResults(jobId),
    enabled: merged?.status === "completed",
    staleTime: Infinity,
  });

  // WebSocket
  useEffect(() => {
    if (!jobId) return;
    const ws = new WebSocket(`${WS_BASE}/ws/job/${jobId}`);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setWsData({ status: d.status, progress: d.progress });
        if (d.log_line) setLogLines((prev) => [...prev, d.log_line]);
        if (d.step) setLogLines((prev) => [...prev, `[${d.step}]`]);
      } catch {}
    };

    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    return () => ws.close();
  }, [jobId]);

  // Build step state from progress
  const currentStep = merged?.progress ?? 0;
  const stepLabel = (wsData as any)?.step ?? "";
  const activeIdx = STEP_PROGRESS_MAP[stepLabel] ?? Math.floor((currentStep / 100) * JOB_STEPS.length);

  const steps: Step[] = JOB_STEPS.map((s, i) => ({
    ...s,
    status:
      merged?.status === "failed"
        ? i === activeIdx ? "error" : i < activeIdx ? "done" : "pending"
        : i < activeIdx
        ? "done"
        : i === activeIdx
        ? merged?.status === "completed" ? "done" : "active"
        : "pending",
  }));

  return {
    job: merged,
    results,
    steps,
    logLines,
    isLoading,
    isCompleted: merged?.status === "completed",
    isFailed: merged?.status === "failed",
    wsConnected,
  };
}

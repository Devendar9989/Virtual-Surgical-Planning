import asyncio
import io
import json
import os
import shutil
import uuid
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from db import create_job, get_job, init_db, list_jobs, update_job
from models import JobResults, JobStatus, StructureResult
from inference import STRUCTURE_FILES, run_segmentation_sync
from ws import manager

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data")))
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
UPLOAD_CHUNK_SIZE = 16 * 1024 * 1024  # 16 MB — fewer async iterations = faster writes
ALLOWED_EXTENSIONS = {".nii", ".gz", ".zip"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load heavy DL libraries so the server starts "hot"
    import logging
    logger = logging.getLogger("osseus")
    logger.info("Initializing database...")
    await init_db()
    
    logger.info("Pre-loading PyTorch and TotalSegmentator models into memory. This may take ~10 seconds...")
    import sys
    import types
    try:
        from nnunetv2.training.dataloading.base_data_loader import nnUNetDataLoaderBase
    except ImportError:
        nnUNetDataLoaderBase = object

    # Hotfix for nnU-Net v2.4+ loading older TotalSegmentator checkpoints
    for mod_name in [
        'nnunetv2.training.dataloading.data_loader'
    ]:
        if mod_name not in sys.modules:
            m = types.ModuleType(mod_name)
            if mod_name == 'nnunetv2.training.dataloading.data_loader':
                m.nnUNetDataLoader = nnUNetDataLoaderBase
            sys.modules[mod_name] = m
            
    from totalsegmentator.python_api import totalsegmentator
    import torch
    import numpy
    import nibabel
    logger.info("Deep learning libraries loaded. Ready for inference!")
    yield


app = FastAPI(title="OsseusAI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Upload (simple, kept for compatibility) ───────────────────────────────────

@app.post("/api/upload")
async def upload_scan(
    background_tasks: BackgroundTasks,
    fast: bool = False,
    file: UploadFile = File(...)
):
    # Validate extension
    name = file.filename or ""
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS and not name.endswith(".nii.gz"):
        raise HTTPException(400, "Unsupported file type. Use .nii.gz, .nii, or .zip")

    job_id = str(uuid.uuid4())
    upload_dir = DATA_DIR / "uploads" / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / name

    size = 0
    buf: list[bytes] = []
    buf_size = 0
    BUF_FLUSH = 64 * 1024 * 1024  # flush to disk every 64 MB
    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(UPLOAD_CHUNK_SIZE):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                dest.unlink(missing_ok=True)
                raise HTTPException(413, "File exceeds 500 MB limit")
            buf.append(chunk)
            buf_size += len(chunk)
            if buf_size >= BUF_FLUSH:
                await f.write(b"".join(buf))
                buf, buf_size = [], 0
        if buf:
            await f.write(b"".join(buf))

    await create_job(job_id, name, size)
    
    # Execute native inference asynchronously in a dedicated background thread pool
    background_tasks.add_task(asyncio.to_thread, run_segmentation_sync, job_id, fast)
    return {"job_id": job_id, "status": "queued"}


# ── Chunked upload (fast path) ────────────────────────────────────────────────
# Protocol:
#   1. POST /api/upload/init   → { job_id, upload_id }
#   2. POST /api/upload/chunk  (x N, parallel OK) → { received }
#   3. POST /api/upload/finalize → { job_id, status }

@app.post("/api/upload/init")
async def upload_init(filename: str, file_size: int, fast: bool = False):
    """Create a job record and a temp file pre-allocated to file_size bytes."""
    name = filename
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS and not name.endswith(".nii.gz"):
        raise HTTPException(400, "Unsupported file type. Use .nii.gz, .nii, or .zip")
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(413, "File exceeds 500 MB limit")

    job_id = str(uuid.uuid4())
    upload_dir = DATA_DIR / "uploads" / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Pre-create the file at full size so parallel chunk writes don't race on file growth
    tmp_path = upload_dir / f".tmp_{name}"
    async with aiofiles.open(tmp_path, "wb") as f:
        # Seek to end and write one byte to allocate
        await f.seek(file_size - 1)
        await f.write(b"\x00")

    await create_job(job_id, name, file_size)
    return {"job_id": job_id, "filename": name}


@app.post("/api/upload/chunk")
async def upload_chunk(
    job_id: str,
    chunk_index: int,
    chunk_offset: int,
    file: UploadFile = File(...),
):
    """Write a single chunk at the correct byte offset. Safe for parallel calls."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    upload_dir = DATA_DIR / "uploads" / job_id
    # Find the tmp file
    tmp_files = list(upload_dir.glob(".tmp_*"))
    if not tmp_files:
        raise HTTPException(404, "Upload session not found — call /init first")
    tmp_path = tmp_files[0]

    data = await file.read()
    # aiofiles doesn't support random-access seek+write cleanly across tasks,
    # so we use a thread to do the raw pwrite (safe on Linux, no GIL issues for I/O)
    import os as _os
    fd = _os.open(str(tmp_path), _os.O_WRONLY)
    try:
        await asyncio.to_thread(_os.pwrite, fd, data, chunk_offset)
    finally:
        _os.close(fd)

    return {"chunk_index": chunk_index, "received": len(data)}


@app.post("/api/upload/finalize")
async def upload_finalize(background_tasks: BackgroundTasks, job_id: str, fast: bool = False):
    """Rename the temp file to its final name and kick off inference."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    upload_dir = DATA_DIR / "uploads" / job_id
    tmp_files = list(upload_dir.glob(".tmp_*"))
    if not tmp_files:
        raise HTTPException(404, "No upload found")
    tmp_path = tmp_files[0]

    final_name = tmp_path.name[5:]  # strip ".tmp_"
    final_path = upload_dir / final_name
    tmp_path.rename(final_path)

    background_tasks.add_task(asyncio.to_thread, run_segmentation_sync, job_id, fast)
    return {"job_id": job_id, "status": "queued"}


# ── Job status ────────────────────────────────────────────────────────────────

@app.get("/api/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        created_at=job["created_at"],
        completed_at=job.get("completed_at"),
        error=job.get("error"),
        filename=job.get("filename"),
        file_size=job.get("file_size"),
    )


# ── Results ───────────────────────────────────────────────────────────────────

@app.get("/api/job/{job_id}/results", response_model=JobResults)
async def get_results(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "completed":
        raise HTTPException(400, f"Job not completed: {job['status']}")
    structures = json.loads(job["results_json"] or "[]")
    return JobResults(
        job_id=job_id,
        structures=[StructureResult(**s) for s in structures],
    )


# ── Download all ──────────────────────────────────────────────────────────────

@app.get("/api/job/{job_id}/download/all")
async def download_all(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "completed":
        raise HTTPException(400, "Job not completed")

    output_dir = DATA_DIR / "outputs" / job_id
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in output_dir.glob("*.nii.gz"):
            zf.write(f, f.name)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=osseus_{job_id}.zip"},
    )

# ── Download single structure ─────────────────────────────────────────────────

@app.get("/api/job/{job_id}/download/{structure}")
async def download_structure(job_id: str, structure: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "completed":
        raise HTTPException(400, "Job not completed")

    if structure.endswith(".nii.gz"):
        structure = structure[:-7]
    elif structure.endswith(".nii"):
        structure = structure[:-4]

    output_dir = DATA_DIR / "outputs" / job_id
    files = STRUCTURE_FILES.get(structure)
    if not files:
        raise HTTPException(404, "Unknown structure")

    # Single file → direct response
    existing = [output_dir / f for f in files if (output_dir / f).exists()]
    if not existing:
        raise HTTPException(404, "Structure file not found")

    if len(existing) == 1:
        return FileResponse(existing[0], filename=existing[0].name, media_type="application/gzip")

    # Multiple files (e.g. bilateral sinuses) → return first
    return FileResponse(existing[0], filename=existing[0].name, media_type="application/gzip")


# ── Delete job ────────────────────────────────────────────────────────────────

@app.delete("/api/job/{job_id}")
async def delete_job(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    shutil.rmtree(DATA_DIR / "uploads" / job_id, ignore_errors=True)
    shutil.rmtree(DATA_DIR / "outputs" / job_id, ignore_errors=True)
    await update_job(job_id, status="deleted")
    return {"message": "deleted"}


# ── Jobs list ─────────────────────────────────────────────────────────────────

@app.get("/api/jobs")
async def get_jobs():
    return await list_jobs()


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/job/{job_id}")
async def websocket_job(websocket: WebSocket, job_id: str):
    await manager.connect(job_id, websocket)
    try:
        # Send current state immediately
        job = await get_job(job_id)
        if job:
            await websocket.send_json({
                "job_id": job_id,
                "status": job["status"],
                "progress": job["progress"],
                "step": job.get("step", ""),
            })
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(job_id, websocket)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}

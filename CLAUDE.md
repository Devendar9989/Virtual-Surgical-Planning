# OsseusAI — CLAUDE.md

## STACK
FE: Next15+AppRouter+TS+TailwindV4+FramerMotion+R3F+TanstackQuery+Zustand+ReactDropzone+Niivue
BE: FastAPI+BackgroundTasks+asyncio+SQLite(aiosqlite)+nibabel+numpy+TotalSegmentator
conda: `vsp_proj` | node: v22

## PATHS
- root: `/data1/miccai/vsp_proj_2/`
- backend: `backend/` (main.py inference.py models.py db.py ws.py)
- frontend: `frontend/` (app/ components/ hooks/ lib/)
- data: `/data/` (uploads/{job_id}/ outputs/{job_id}/ osseus.db)

## API
POST /api/upload → {job_id,status}
GET  /api/job/{id} → JobStatus
GET  /api/job/{id}/results → JobResults
GET  /api/job/{id}/download/{structure}
GET  /api/job/{id}/download/all
DELETE /api/job/{id}
WS   /ws/job/{id}

## STRUCTURES (craniofacial_structures task)
skull mandible teeth_upper teeth_lower sinus_maxillary sinus_frontal

## DEV RUN
```bash
# Terminal 1 — Backend
cd backend && conda run -n vsp_proj uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info

# Terminal 2 — Frontend
cd frontend && npm run dev
```

## KEY DECISIONS
- SQLite via aiosqlite (no postgres overhead for MVP)
- Inference runs via FastAPI BackgroundTasks + asyncio.to_thread (no Celery/Redis needed)
- WebSocket broadcasts via in-process ConnectionManager in ws.py
- XHR upload (not fetch) for progress %
- TotalSegmentator weights → ~/.totalsegmentator (auto-download 1st run ~500MB)
- GPU via torch cu117 already in vsp_proj

## COLORS
bg:#080B12 surface:#0E1420 border:#1E2A40
cyan:#00D4FF violet:#7B61FF green:#00FF94

import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket

# In-memory set of active WebSocket connections per job
_connections: Dict[str, Set[WebSocket]] = {}


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, job_id: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(job_id, set()).add(ws)

    def disconnect(self, job_id: str, ws: WebSocket):
        if job_id in self._connections:
            self._connections[job_id].discard(ws)

    async def broadcast(self, job_id: str, payload: dict):
        dead = set()
        for ws in self._connections.get(job_id, set()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[job_id].discard(ws)


manager = ConnectionManager()


async def publish_progress(job_id: str, status: str, progress: int, step: str, log_line: str = ""):
    """Async native broadcast (called from inference task)."""
    payload = {
        "job_id": job_id,
        "status": status,
        "progress": progress,
        "step": step,
        "log_line": log_line,
    }
    await manager.broadcast(job_id, payload)

import aiosqlite
import json
from datetime import datetime
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

DB_PATH = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data"))) / "osseus.db"


async def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'queued',
                progress INTEGER NOT NULL DEFAULT 0,
                step TEXT NOT NULL DEFAULT 'Queued',
                created_at TEXT NOT NULL,
                completed_at TEXT,
                error TEXT,
                filename TEXT,
                file_size INTEGER,
                results_json TEXT
            )
        """)
        await db.commit()


async def create_job(job_id: str, filename: str, file_size: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO jobs (id, status, progress, step, created_at, filename, file_size)
               VALUES (?, 'queued', 0, 'Queued', ?, ?, ?)""",
            (job_id, datetime.utcnow().isoformat(), filename, file_size),
        )
        await db.commit()


async def get_job(job_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def update_job(job_id: str, **kwargs):
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE jobs SET {sets} WHERE id = ?", vals)
        await db.commit()


async def set_job_completed(job_id: str, results: list):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """UPDATE jobs SET status='completed', progress=100, step='Done',
               completed_at=?, results_json=? WHERE id=?""",
            (datetime.utcnow().isoformat(), json.dumps(results), job_id),
        )
        await db.commit()


async def set_job_failed(job_id: str, error: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """UPDATE jobs SET status='failed', completed_at=?, error=? WHERE id=?""",
            (datetime.utcnow().isoformat(), error, job_id),
        )
        await db.commit()


async def list_jobs(limit: int = 50) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

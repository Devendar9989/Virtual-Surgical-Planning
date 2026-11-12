from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class JobCreate(BaseModel):
    filename: str
    file_size: int


class StructureResult(BaseModel):
    name: str
    file_url: str
    voxel_count: int
    volume_cm3: float


class JobStatus(BaseModel):
    job_id: str
    status: str  # queued | processing | completed | failed
    progress: int  # 0-100
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None


class JobResults(BaseModel):
    job_id: str
    structures: List[StructureResult]


class ProgressUpdate(BaseModel):
    job_id: str
    status: str
    progress: int
    step: str
    log_line: Optional[str] = None

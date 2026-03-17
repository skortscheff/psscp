from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.job import JobType, JobStatus

class JobResponse(BaseModel):
    id: str
    type: JobType
    status: JobStatus
    progress: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class JobDetailResponse(JobResponse):
    user_id: str
    vm_id: Optional[str]
    log: str
    celery_task_id: Optional[str]

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel

class JobType(str, Enum):
    create_vm = "create_vm"
    delete_vm = "delete_vm"
    start_vm = "start_vm"
    stop_vm = "stop_vm"
    reboot_vm = "reboot_vm"
    register_cluster = "register_cluster"
    delete_cluster = "delete_cluster"

class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"

class Job(SQLModel, table=True):
    __tablename__ = "jobs"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    vm_id: Optional[str] = Field(default=None, foreign_key="vms.id")
    type: JobType
    status: JobStatus = Field(default=JobStatus.pending)
    progress: int = Field(default=0)
    log: str = Field(default="")
    celery_task_id: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

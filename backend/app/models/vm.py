import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel

class VMStatus(str, Enum):
    provisioning = "provisioning"
    running = "running"
    stopped = "stopped"
    error = "error"
    deleted = "deleted"

class VM(SQLModel, table=True):
    __tablename__ = "vms"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    cluster_id: str = Field(foreign_key="clusters.id", index=True)
    flavor_id: str = Field(foreign_key="flavors.id", index=True)
    network_id: Optional[str] = Field(default=None, foreign_key="networks.id")
    proxmox_vmid: Optional[int] = Field(default=None)
    name: str
    status: VMStatus = Field(default=VMStatus.provisioning)
    ip_address: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

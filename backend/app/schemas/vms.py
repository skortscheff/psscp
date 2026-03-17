import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from app.models.vm import VMStatus

_VM_NAME_RE = re.compile(r'^[a-zA-Z0-9_-]+$')

class VMCreate(BaseModel):
    name: str
    cluster_id: str
    flavor_id: str
    template_id: str
    network_id: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("VM name must not be empty")
        if len(v) > 63:
            raise ValueError("VM name must be 63 characters or fewer")
        if not _VM_NAME_RE.match(v):
            raise ValueError("VM name may only contain letters, digits, hyphens, and underscores")
        return v

class VMResponse(BaseModel):
    id: str
    name: str
    status: VMStatus
    cluster_id: str
    flavor_id: str
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

class VMDetailResponse(VMResponse):
    user_id: str
    network_id: Optional[str]
    proxmox_vmid: Optional[int]

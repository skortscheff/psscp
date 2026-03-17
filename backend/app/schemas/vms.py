from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.vm import VMStatus

class VMCreate(BaseModel):
    name: str
    cluster_id: str
    flavor_id: str
    template_id: str
    network_id: Optional[str] = None

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

from typing import Optional
from pydantic import BaseModel
from app.models.flavor import DiskBus

class FlavorCreate(BaseModel):
    cluster_id: str
    name: str
    vcpus: int
    ram_mb: int
    disk_gb: int
    disk_bus: DiskBus = DiskBus.virtio

class FlavorUpdate(BaseModel):
    name: Optional[str] = None
    vcpus: Optional[int] = None
    ram_mb: Optional[int] = None
    disk_gb: Optional[int] = None
    disk_bus: Optional[DiskBus] = None

class FlavorResponse(BaseModel):
    id: str
    cluster_id: str
    name: str
    vcpus: int
    ram_mb: int
    disk_gb: int
    disk_bus: DiskBus
    is_active: bool

    model_config = {"from_attributes": True}

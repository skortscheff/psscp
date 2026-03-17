import uuid
from enum import Enum
from sqlmodel import Field, SQLModel

class DiskBus(str, Enum):
    virtio = "virtio"
    scsi = "scsi"
    ide = "ide"

class Flavor(SQLModel, table=True):
    __tablename__ = "flavors"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    cluster_id: str = Field(foreign_key="clusters.id", index=True)
    name: str
    vcpus: int
    ram_mb: int
    disk_gb: int
    disk_bus: DiskBus = Field(default=DiskBus.virtio)
    is_active: bool = Field(default=True)

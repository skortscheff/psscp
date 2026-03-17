from typing import Optional
from sqlmodel import Field, SQLModel

SYSTEM_CONFIG_ID = "00000000-0000-0000-0000-000000000001"

class SystemConfiguration(SQLModel, table=True):
    __tablename__ = "system_configuration"
    id: str = Field(default=SYSTEM_CONFIG_ID, primary_key=True)
    default_cluster_id: Optional[str] = Field(default=None, foreign_key="clusters.id")
    vm_name_prefix: str = Field(default="vm-")
    max_vms_per_user: int = Field(default=10)
    allow_self_registration: bool = Field(default=False)

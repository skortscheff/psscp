from typing import Optional
from pydantic import BaseModel

class SystemConfigUpdate(BaseModel):
    default_cluster_id: Optional[str] = None
    vm_name_prefix: Optional[str] = None
    max_vms_per_user: Optional[int] = None
    allow_self_registration: Optional[bool] = None

class SystemConfigResponse(BaseModel):
    default_cluster_id: Optional[str]
    vm_name_prefix: str
    max_vms_per_user: int
    allow_self_registration: bool

    model_config = {"from_attributes": True}

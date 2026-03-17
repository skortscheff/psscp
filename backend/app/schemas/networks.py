from typing import Optional
from pydantic import BaseModel
from app.models.network import NetworkType

class NetworkCreate(BaseModel):
    cluster_id: str
    name: str
    type: NetworkType
    bridge_name: str
    vxlan_id: Optional[int] = None

class NetworkResponse(BaseModel):
    id: str
    cluster_id: str
    name: str
    type: NetworkType
    bridge_name: str
    vxlan_id: Optional[int]

    model_config = {"from_attributes": True}

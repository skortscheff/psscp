from typing import Optional
from pydantic import BaseModel

class ClusterCreate(BaseModel):
    name: str
    api_url: str
    api_token_id: str
    api_token_secret: str
    tls_verify: bool = True

class ClusterUpdate(BaseModel):
    name: Optional[str] = None
    api_url: Optional[str] = None
    api_token_id: Optional[str] = None
    api_token_secret: Optional[str] = None
    tls_verify: Optional[bool] = None

class ClusterResponse(BaseModel):
    id: str
    name: str
    api_url: str
    api_token_id: str
    tls_verify: bool
    sdn_enabled: bool
    is_active: bool

    model_config = {"from_attributes": True}

class ClusterDetailResponse(ClusterResponse):
    vm_count: int = 0
    flavor_count: int = 0
    network_count: int = 0

class ClusterNodeInfo(BaseModel):
    name: str
    status: str
    uptime: Optional[int] = None
    cpu_usage: Optional[float] = None
    mem_used: Optional[int] = None
    mem_total: Optional[int] = None

class ClusterTestResult(BaseModel):
    success: bool
    error: Optional[str] = None
    version: Optional[str] = None
    nodes: list[ClusterNodeInfo] = []
    sdn_detected: bool = False
    template_count: int = 0

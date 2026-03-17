import uuid
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel

class NetworkType(str, Enum):
    bridge = "bridge"
    vxlan = "vxlan"

class Network(SQLModel, table=True):
    __tablename__ = "networks"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    cluster_id: str = Field(foreign_key="clusters.id", index=True)
    name: str
    type: NetworkType
    bridge_name: str
    vxlan_id: Optional[int] = Field(default=None)

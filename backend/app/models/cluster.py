import uuid
from sqlmodel import Field, SQLModel

class Cluster(SQLModel, table=True):
    __tablename__ = "clusters"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(unique=True, index=True)
    api_url: str
    api_token_id: str
    api_token_secret: str  # encrypted at rest
    tls_verify: bool = Field(default=True)
    sdn_enabled: bool = Field(default=False)
    is_active: bool = Field(default=True)

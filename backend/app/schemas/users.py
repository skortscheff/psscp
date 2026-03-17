from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.user import UserRole

class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.user

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None

class UserResponse(BaseModel):
    id: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

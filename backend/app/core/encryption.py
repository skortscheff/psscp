from cryptography.fernet import Fernet
from app.core.config import get_settings

def _get_fernet() -> Fernet:
    settings = get_settings()
    return Fernet(settings.ENCRYPTION_KEY.encode())

def encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    return _get_fernet().decrypt(value.encode()).decode()

import pytest
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

def test_hash_and_verify():
    hashed = hash_password("mysecret")
    assert verify_password("mysecret", hashed)
    assert not verify_password("wrong", hashed)

def test_access_token(monkeypatch):
    import app.core.security as sec
    import app.core.config as cfg
    monkeypatch.setattr(cfg.get_settings(), "SECRET_KEY", "testsecret")
    monkeypatch.setattr(cfg.get_settings(), "ACCESS_TOKEN_EXPIRE_MINUTES", 15)
    token = create_access_token({"sub": "user-123"})
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"

def test_refresh_token(monkeypatch):
    import app.core.security as sec
    import app.core.config as cfg
    monkeypatch.setattr(cfg.get_settings(), "SECRET_KEY", "testsecret")
    monkeypatch.setattr(cfg.get_settings(), "REFRESH_TOKEN_EXPIRE_DAYS", 7)
    token = create_refresh_token({"sub": "user-456"})
    payload = decode_token(token)
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"

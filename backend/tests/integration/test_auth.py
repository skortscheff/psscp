import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from app.main import app
from app.core.deps import get_db
from app.core.security import hash_password
from app.models.user import User, UserRole

TEST_DB_URL = "postgresql://psscp:psscp@localhost:5432/psscp_test"

@pytest.fixture(scope="session")
def engine():
    e = create_engine(TEST_DB_URL)
    SQLModel.metadata.create_all(e)
    yield e
    SQLModel.metadata.drop_all(e)

@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session
        session.rollback()

@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def admin_user(db):
    user = User(
        email="admin@example.com",
        hashed_password=hash_password("adminpass"),
        role=UserRole.admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db.delete(user)
    db.commit()

def test_login_success(client, admin_user):
    resp = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "adminpass"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client, admin_user):
    resp = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "wrong"})
    assert resp.status_code == 401

def test_refresh(client, admin_user):
    login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "adminpass"})
    # refresh_token set as httponly cookie
    resp = client.post("/api/v1/auth/refresh")
    assert resp.status_code == 200

def test_logout(client, admin_user):
    login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "adminpass"})
    token = login.json()["access_token"]
    resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

def test_health(client):
    resp = client.get("/api/v1/system/health")
    assert resp.status_code in (200, 503)
    assert "status" in resp.json()

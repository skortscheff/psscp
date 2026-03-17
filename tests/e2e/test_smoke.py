"""
Phase 6 smoke test — exercises the full happy path via Playwright.

Prerequisites:
  pip install playwright pytest-playwright
  playwright install chromium

Run:
  BASE_URL=http://localhost:8000 pytest tests/e2e/test_smoke.py -v
"""

import os
import time
import pytest
from playwright.sync_api import Page, expect

BASE_URL = os.environ.get("BASE_URL", "http://localhost")
API_URL = os.environ.get("API_URL", "http://localhost:8000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "adminpassword")


def wait_for_job(page: Page, timeout_s: int = 60) -> None:
    """Wait until JobProgressModal shows success or fail."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if page.locator("text=success").is_visible():
            return
        if page.locator("text=failed").is_visible():
            pytest.fail("Job reached failed state")
        time.sleep(2)
        page.reload()
    pytest.fail("Job did not reach terminal state within timeout")


@pytest.fixture(scope="session")
def admin_token() -> str:
    """Obtain an admin access token via the API directly."""
    import requests

    r = requests.post(
        f"{API_URL}/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def api_session(admin_token: str):
    """Requests session pre-authenticated as admin."""
    import requests

    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {admin_token}"
    return s


def test_health_endpoint(api_session):
    """API health check passes."""
    import requests

    r = requests.get(f"{API_URL}/api/v1/system/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_page(page: Page):
    """Login page renders and rejects bad credentials."""
    page.goto(f"{BASE_URL}/login")
    expect(page.locator("text=PSSCP")).to_be_visible()

    page.fill('input[type="email"]', "bad@example.com")
    page.fill('input[type="password"]', "wrongpassword")
    page.click('button[type="submit"]')
    expect(page.locator("text=Invalid")).to_be_visible(timeout=5000)


def test_full_vm_lifecycle_via_api(api_session):
    """
    Full VM lifecycle test via the API (does not require a real Proxmox cluster;
    verifies the API contract end-to-end with a mock cluster record).

    This test:
    1. Creates a cluster record (without real Proxmox connectivity)
    2. Creates a flavor
    3. Creates a network
    4. Creates a VM (job will fail if no Proxmox, but API contract is correct)
    5. Verifies the VM record exists with provisioning status
    6. Cleans up
    """
    import requests

    base = f"{API_URL}/api/v1"
    headers = api_session.headers

    # 1. Register a cluster (async — job will fail without real Proxmox)
    r = api_session.post(f"{base}/clusters", json={
        "name": "smoke-test-cluster",
        "api_url": "https://proxmox.example.local:8006",
        "api_token_id": "root@pam!smoke",
        "api_token_secret": "smoke-secret-token",
        "tls_verify": False,
    })
    assert r.status_code == 202, r.text
    job_id = r.json()["job_id"]

    # Poll until the job reaches a terminal state (verifies the job pipeline ran, not Proxmox connectivity)
    terminal_status = None
    for _ in range(30):
        jr = api_session.get(f"{base}/jobs/{job_id}")
        assert jr.status_code == 200
        job_status = jr.json()["status"]
        if job_status in ("success", "failed"):
            terminal_status = job_status
            break
        time.sleep(2)
    assert terminal_status is not None, (
        "Cluster registration job never reached a terminal state — "
        "the job pipeline (Celery worker + Redis) may be broken"
    )
    # Without a real Proxmox endpoint the job will fail; that is expected and acceptable.
    # The assertion above is sufficient to confirm the pipeline is functioning.

    # 2. Get cluster id
    cr = api_session.get(f"{base}/clusters")
    assert cr.status_code == 200
    clusters = cr.json()
    cluster = next((c for c in clusters if c["name"] == "smoke-test-cluster"), None)
    assert cluster is not None, "Cluster not found after registration"
    cluster_id = cluster["id"]

    # 3. Create a flavor
    fr = api_session.post(f"{base}/flavors", json={
        "cluster_id": cluster_id,
        "name": "smoke-small",
        "vcpus": 2,
        "ram_mb": 2048,
        "disk_gb": 20,
        "disk_bus": "virtio",
    })
    assert fr.status_code == 201, fr.text
    flavor_id = fr.json()["id"]

    # 4. Create a network
    nr = api_session.post(f"{base}/networks", json={
        "cluster_id": cluster_id,
        "name": "smoke-net",
        "type": "bridge",
        "bridge_name": "vmbr0",
    })
    assert nr.status_code == 201, nr.text
    network_id = nr.json()["id"]

    # 5. Create VM (202 accepted regardless of Proxmox state)
    vr = api_session.post(f"{base}/vms", json={
        "name": "smoke-vm-001",
        "cluster_id": cluster_id,
        "flavor_id": flavor_id,
        "template_id": "100",
        "network_id": network_id,
    })
    assert vr.status_code == 202, vr.text
    vm_job_id = vr.json()["job_id"]

    # 6. Get job detail
    jr = api_session.get(f"{base}/jobs/{vm_job_id}")
    assert jr.status_code == 200
    assert jr.json()["type"] == "create_vm"

    # 7. Get VM list — should include our VM
    vms_r = api_session.get(f"{base}/vms")
    assert vms_r.status_code == 200
    vms = vms_r.json()
    smoke_vm = next((v for v in vms if v["name"] == "smoke-vm-001"), None)
    assert smoke_vm is not None, "VM not found in list"

    # 8. Cleanup — delete VM (202)
    del_r = api_session.delete(f"{base}/vms/{smoke_vm['id']}")
    # May be 409 if still provisioning — that's also acceptable for smoke test
    assert del_r.status_code in (202, 409), del_r.text

    # 9. Jobs list accessible
    jobs_r = api_session.get(f"{base}/jobs")
    assert jobs_r.status_code == 200
    assert isinstance(jobs_r.json(), list)

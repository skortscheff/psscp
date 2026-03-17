from datetime import datetime, timezone
from celery import Task
from sqlmodel import Session, select
from app.celery_app import celery_app
from app.db import engine
from app.models.job import Job, JobStatus
from app.models.cluster import Cluster
from app.models.vm import VM, VMStatus
from app.driver.proxmox_client import ProxmoxClient
from app.driver.sdn_manager import SDNManager
import sqlalchemy


def _log(db: Session, job: Job, message: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    db.execute(
        sqlalchemy.text("UPDATE jobs SET log = log || :line WHERE id = :id"),
        {"line": f"[{ts}] {message}\n", "id": job.id}
    )
    db.commit()

def _set_status(db: Session, job: Job, status: JobStatus, progress: int | None = None) -> None:
    job.status = status
    job.updated_at = datetime.now(timezone.utc)
    if progress is not None:
        job.progress = progress
    db.add(job)
    db.commit()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    name="tasks.register_cluster",
)
def register_cluster_task(self: Task, job_id: str, cluster_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        cluster = db.get(Cluster, cluster_id)
        if not job or not cluster:
            return
        _set_status(db, job, JobStatus.running, 0)
        _log(db, job, "Starting cluster registration")
        try:
            _log(db, job, f"Testing connectivity to {cluster.api_url}")
            client = ProxmoxClient(cluster)
            client.get_api().version.get()
            _log(db, job, "Connectivity OK")
            _set_status(db, job, JobStatus.running, 50)

            _log(db, job, "Detecting SDN capability")
            sdn = SDNManager.detect_sdn(client)
            cluster.sdn_enabled = sdn
            db.add(cluster)
            db.commit()
            _log(db, job, f"SDN detected: {sdn}")
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, "Cluster registration complete")
        except Exception as exc:
            _log(db, job, f"Error: {exc}")
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed, None)
                _log(db, job, "Max retries exceeded — registration failed")


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    name="tasks.delete_cluster",
)
def delete_cluster_task(self: Task, job_id: str, cluster_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        cluster = db.get(Cluster, cluster_id)
        if not job or not cluster:
            return
        _set_status(db, job, JobStatus.running, 0)
        _log(db, job, "Starting cluster deletion")
        try:
            active_vms = db.exec(
                select(VM).where(VM.cluster_id == cluster_id, VM.status != VMStatus.deleted)
            ).first()
            if active_vms:
                _log(db, job, "Cannot delete cluster: active VMs exist")
                _set_status(db, job, JobStatus.failed)
                return
            cluster.is_active = False
            db.add(cluster)
            db.commit()
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, "Cluster deleted")
        except Exception as exc:
            _log(db, job, f"Error: {exc}")
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed)

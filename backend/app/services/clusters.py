import uuid
from datetime import datetime, timezone
from sqlmodel import Session
from app.core.encryption import encrypt
from app.models.cluster import Cluster
from app.models.job import Job, JobType, JobStatus
from app.models.user import User
from app.schemas.clusters import ClusterCreate
from app.schemas.common import JobResponse

def enqueue_register_cluster(db: Session, admin: User, body: ClusterCreate) -> JobResponse:
    cluster = Cluster(
        name=body.name,
        api_url=body.api_url,
        api_token_id=body.api_token_id,
        api_token_secret=encrypt(body.api_token_secret),
        tls_verify=body.tls_verify,
    )
    db.add(cluster)
    db.flush()

    job = Job(
        user_id=admin.id,
        type=JobType.register_cluster,
        status=JobStatus.pending,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    db.refresh(cluster)

    from app.tasks.clusters import register_cluster_task
    result = register_cluster_task.delay(job.id, cluster.id)
    job.celery_task_id = result.id
    db.add(job)
    db.commit()

    return JobResponse(job_id=job.id)

def enqueue_delete_cluster(db: Session, admin: User, cluster_id: str) -> JobResponse:
    job = Job(
        user_id=admin.id,
        type=JobType.delete_cluster,
        status=JobStatus.pending,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    from app.tasks.clusters import delete_cluster_task
    result = delete_cluster_task.delay(job.id, cluster_id)
    job.celery_task_id = result.id
    db.add(job)
    db.commit()

    return JobResponse(job_id=job.id)

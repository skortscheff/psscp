from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.core.deps import get_db, get_current_user
from app.models.user import User, UserRole
from app.models.job import Job, JobStatus, JobType
from app.schemas.jobs import JobResponse, JobDetailResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("", response_model=list[JobResponse])
def list_jobs(
    job_status: JobStatus | None = None,
    job_type: JobType | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Job)
    if current_user.role != UserRole.admin:
        q = q.where(Job.user_id == current_user.id)
    if job_status:
        q = q.where(Job.status == job_status)
    if job_type:
        q = q.where(Job.type == job_type)
    return db.exec(q).all()

@router.get("/{job_id}", response_model=JobDetailResponse)
def get_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if current_user.role != UserRole.admin and job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return job

@router.post("/{job_id}/cancel", response_model=JobDetailResponse)
def cancel_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if current_user.role != UserRole.admin and job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if job.status not in (JobStatus.pending, JobStatus.running):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job is already in a terminal state")

    # Revoke the Celery task if one was dispatched
    if job.celery_task_id:
        try:
            from app.celery_app import celery_app
            celery_app.control.revoke(job.celery_task_id, terminate=True, signal="SIGTERM")
        except Exception:
            pass  # Best-effort; still mark cancelled in DB

    job.status = JobStatus.cancelled
    job.updated_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

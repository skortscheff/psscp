import redis as redis_lib
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select, func
from app.core.config import get_settings
from app.core.deps import get_db, get_current_user, require_admin
from app.core.security import hash_password, create_access_token, create_refresh_token
from app.models.user import User, UserRole
from app.models.cluster import Cluster
from app.models.vm import VM, VMStatus
from app.models.job import Job, JobStatus
from app.models.system_config import SystemConfiguration, SYSTEM_CONFIG_ID
from app.schemas.system_config import SystemConfigUpdate, SystemConfigResponse
from app.schemas.auth import TokenResponse

router = APIRouter(prefix="/system", tags=["system"])
settings = get_settings()


class SetupRequest(BaseModel):
    email: str
    password: str


@router.get("/setup-status")
def setup_status(db: Session = Depends(get_db)):
    count = db.exec(select(func.count()).select_from(User)).one()
    return {"needs_setup": count == 0}


@router.post("/setup", response_model=TokenResponse)
def run_setup(body: SetupRequest, response: Response, db: Session = Depends(get_db)):
    count = db.exec(select(func.count()).select_from(User)).one()
    if count > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Setup already completed")
    admin = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.admin,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    access_token = create_access_token({"sub": admin.id})
    refresh_token = create_refresh_token({"sub": admin.id})
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db_status = "ok"
    redis_status = "ok"
    try:
        db.exec(select(1))
    except Exception:
        db_status = "error"
    try:
        r = redis_lib.from_url(settings.REDIS_URL)
        r.ping()
    except Exception:
        redis_status = "error"
    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    status_code = 200 if overall == "ok" else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": overall, "database": db_status, "redis": redis_status, "version": settings.APP_VERSION},
    )

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_admin = current_user.role == UserRole.admin

    # VM counts — admins see all, users see their own
    def vm_count(s: VMStatus) -> int:
        q = select(func.count()).select_from(VM).where(VM.status == s)
        if not is_admin:
            q = q.where(VM.user_id == current_user.id)
        return db.exec(q).one()

    vm_running = vm_count(VMStatus.running)
    vm_stopped = vm_count(VMStatus.stopped)
    vm_provisioning = vm_count(VMStatus.provisioning)
    vm_error = vm_count(VMStatus.error)
    vm_total = vm_running + vm_stopped + vm_provisioning + vm_error

    # Active jobs (pending + running)
    def job_count(s: JobStatus) -> int:
        q = select(func.count()).select_from(Job).where(Job.status == s)
        if not is_admin:
            q = q.where(Job.user_id == current_user.id)
        return db.exec(q).one()

    jobs_running = job_count(JobStatus.running) + job_count(JobStatus.pending)
    jobs_failed = job_count(JobStatus.failed)

    result: dict = {
        "vm_total": vm_total,
        "vm_running": vm_running,
        "vm_stopped": vm_stopped,
        "vm_provisioning": vm_provisioning,
        "vm_error": vm_error,
        "jobs_active": jobs_running,
        "jobs_failed": jobs_failed,
    }

    if is_admin:
        result["cluster_count"] = db.exec(
            select(func.count()).select_from(Cluster).where(Cluster.is_active == True)
        ).one()
        result["user_count"] = db.exec(
            select(func.count()).select_from(User).where(User.is_active == True)
        ).one()

    return result


def _get_or_create_config(db: Session) -> SystemConfiguration:
    config = db.get(SystemConfiguration, SYSTEM_CONFIG_ID)
    if not config:
        config = SystemConfiguration(id=SYSTEM_CONFIG_ID)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.get("/config", response_model=SystemConfigResponse)
def get_config(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return _get_or_create_config(db)

@router.patch("/config", response_model=SystemConfigResponse)
def update_config(body: SystemConfigUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    config = _get_or_create_config(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(config, field, value)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

from sqlmodel import Session
from app.models.vm import VM, VMStatus
from app.models.job import Job, JobType, JobStatus
from app.models.user import User
from app.schemas.vms import VMCreate
from app.schemas.common import JobResponse

def enqueue_create_vm(db: Session, user: User, body: VMCreate) -> JobResponse:
    vm = VM(
        user_id=user.id,
        cluster_id=body.cluster_id,
        flavor_id=body.flavor_id,
        network_id=body.network_id,
        name=body.name,
        status=VMStatus.provisioning,
    )
    db.add(vm)
    db.flush()

    job = Job(
        user_id=user.id,
        vm_id=vm.id,
        type=JobType.create_vm,
        status=JobStatus.pending,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    db.refresh(vm)

    from app.tasks.vms import create_vm_task
    result = create_vm_task.delay(job.id, vm.id, body.template_id)
    job.celery_task_id = result.id
    db.add(job)
    db.commit()

    return JobResponse(job_id=job.id)

def enqueue_delete_vm(db: Session, user: User, vm: VM) -> JobResponse:
    job = Job(
        user_id=user.id,
        vm_id=vm.id,
        type=JobType.delete_vm,
        status=JobStatus.pending,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    from app.tasks.vms import delete_vm_task
    result = delete_vm_task.delay(job.id, vm.id)
    job.celery_task_id = result.id
    db.add(job)
    db.commit()

    return JobResponse(job_id=job.id)

def enqueue_vm_action(db: Session, user: User, vm: VM, job_type: JobType) -> JobResponse:
    job = Job(
        user_id=user.id,
        vm_id=vm.id,
        type=job_type,
        status=JobStatus.pending,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    from app.tasks.vms import start_vm_task, stop_vm_task, reboot_vm_task
    task_map = {
        JobType.start_vm: start_vm_task,
        JobType.stop_vm: stop_vm_task,
        JobType.reboot_vm: reboot_vm_task,
    }
    result = task_map[job_type].delay(job.id, vm.id)
    job.celery_task_id = result.id
    db.add(job)
    db.commit()

    return JobResponse(job_id=job.id)

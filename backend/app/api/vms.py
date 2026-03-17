from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.core.deps import get_db, get_current_user
from app.models.user import User, UserRole
from app.models.vm import VM, VMStatus
from app.models.network import Network, NetworkType
from app.models.cluster import Cluster
from app.schemas.vms import VMCreate, VMResponse, VMDetailResponse
from app.schemas.common import JobResponse
from app.services.vms import enqueue_create_vm, enqueue_delete_vm, enqueue_vm_action
from app.models.job import JobType

router = APIRouter(prefix="/vms", tags=["vms"])

@router.get("", response_model=list[VMResponse])
def list_vms(
    vm_status: VMStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(VM).where(VM.status != VMStatus.deleted)
    if current_user.role != UserRole.admin:
        q = q.where(VM.user_id == current_user.id)
    if vm_status:
        q = q.where(VM.status == vm_status)
    return db.exec(q).all()

@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def create_vm(body: VMCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if body.network_id:
        network = db.get(Network, body.network_id)
        if network and network.type == NetworkType.vxlan:
            cluster = db.get(Cluster, body.cluster_id)
            if not cluster or not cluster.sdn_enabled:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SDN network requires sdn_enabled cluster")
    return enqueue_create_vm(db, current_user, body)

@router.get("/{vm_id}", response_model=VMDetailResponse)
def get_vm(vm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vm = db.get(VM, vm_id)
    if not vm or vm.status == VMStatus.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VM not found")
    if current_user.role != UserRole.admin and vm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return vm

@router.delete("/{vm_id}", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def delete_vm(vm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vm = db.get(VM, vm_id)
    if not vm or vm.status == VMStatus.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VM not found")
    if current_user.role != UserRole.admin and vm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if vm.status == VMStatus.provisioning:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="VM is currently provisioning")
    return enqueue_delete_vm(db, current_user, vm)

@router.post("/{vm_id}/start", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def start_vm(vm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vm = db.get(VM, vm_id)
    if not vm or vm.status == VMStatus.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VM not found")
    if current_user.role != UserRole.admin and vm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return enqueue_vm_action(db, current_user, vm, JobType.start_vm)

@router.post("/{vm_id}/stop", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def stop_vm(vm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vm = db.get(VM, vm_id)
    if not vm or vm.status == VMStatus.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VM not found")
    if current_user.role != UserRole.admin and vm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return enqueue_vm_action(db, current_user, vm, JobType.stop_vm)

@router.post("/{vm_id}/reboot", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def reboot_vm(vm_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vm = db.get(VM, vm_id)
    if not vm or vm.status == VMStatus.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VM not found")
    if current_user.role != UserRole.admin and vm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return enqueue_vm_action(db, current_user, vm, JobType.reboot_vm)

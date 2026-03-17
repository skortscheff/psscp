import time
from datetime import datetime, timezone
from celery import Task
from sqlmodel import Session, select
from app.celery_app import celery_app
from app.db import engine
from app.models.job import Job, JobStatus
from app.models.vm import VM, VMStatus
from app.models.flavor import Flavor
from app.models.network import Network, NetworkType
from app.models.cluster import Cluster
from app.driver.proxmox_client import ProxmoxClient
from app.driver.vm_provisioner import VMProvisioner
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
    name="tasks.create_vm",
)
def create_vm_task(self: Task, job_id: str, vm_id: str, template_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        vm = db.get(VM, vm_id)
        if not job or not vm:
            return
        flavor = db.get(Flavor, vm.flavor_id)
        cluster = db.get(Cluster, vm.cluster_id)
        network = db.get(Network, vm.network_id) if vm.network_id else None

        _set_status(db, job, JobStatus.running, 0)
        _log(db, job, f"Starting VM creation: {vm.name}")

        try:
            client = ProxmoxClient(cluster)

            _log(db, job, "Finding free VMID")
            new_vmid = VMProvisioner.find_free_vmid(client)
            vm.proxmox_vmid = new_vmid
            db.add(vm)
            db.commit()

            _log(db, job, f"Cloning template {template_id} as VMID {new_vmid}")
            VMProvisioner.clone_template(client, int(template_id), new_vmid, vm.name)
            _set_status(db, job, JobStatus.running, 20)
            _log(db, job, "Template cloned")

            _log(db, job, f"Applying flavor: {flavor.vcpus} vCPUs, {flavor.ram_mb} MB RAM")
            VMProvisioner.configure_vm(client, new_vmid, flavor.vcpus, flavor.ram_mb)
            _set_status(db, job, JobStatus.running, 50)

            if network:
                if network.type == NetworkType.vxlan and network.vxlan_id:
                    _log(db, job, f"Ensuring SDN VNet for VXLAN {network.vxlan_id}")
                    SDNManager.ensure_vnet(client, network.vxlan_id)
                _log(db, job, f"Attaching network: {network.bridge_name}")
                VMProvisioner.attach_network(client, new_vmid, network.bridge_name)
            _set_status(db, job, JobStatus.running, 70)

            _log(db, job, "Starting VM")
            VMProvisioner.start_vm(client, new_vmid)
            _set_status(db, job, JobStatus.running, 85)

            _log(db, job, "Waiting for IP address (QEMU guest agent)")
            ip = None
            for _ in range(12):
                ip = VMProvisioner.get_ip_address(client, new_vmid)
                if ip:
                    break
                time.sleep(5)

            vm.ip_address = ip
            vm.status = VMStatus.running
            db.add(vm)
            db.commit()
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, f"VM running. IP: {ip or 'unavailable'}")

        except Exception as exc:
            _log(db, job, f"Error: {exc}")
            vm.status = VMStatus.error
            db.add(vm)
            db.commit()
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed)
                _log(db, job, "VM creation failed")


@celery_app.task(bind=True, max_retries=3, name="tasks.delete_vm")
def delete_vm_task(self: Task, job_id: str, vm_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        vm = db.get(VM, vm_id)
        if not job or not vm:
            return
        _set_status(db, job, JobStatus.running, 0)
        _log(db, job, "Deleting VM")
        try:
            if vm.proxmox_vmid:
                cluster = db.get(Cluster, vm.cluster_id)
                client = ProxmoxClient(cluster)
                try:
                    VMProvisioner.stop_vm(client, vm.proxmox_vmid)
                    time.sleep(2)
                except Exception:
                    pass
                VMProvisioner.delete_vm(client, vm.proxmox_vmid)
            vm.status = VMStatus.deleted
            db.add(vm)
            db.commit()
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, "VM deleted")
        except Exception as exc:
            _log(db, job, f"Error: {exc}")
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed)


@celery_app.task(bind=True, max_retries=3, name="tasks.start_vm")
def start_vm_task(self: Task, job_id: str, vm_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        vm = db.get(VM, vm_id)
        if not job or not vm:
            return
        _set_status(db, job, JobStatus.running, 0)
        try:
            cluster = db.get(Cluster, vm.cluster_id)
            client = ProxmoxClient(cluster)
            VMProvisioner.start_vm(client, vm.proxmox_vmid)
            vm.status = VMStatus.running
            db.add(vm)
            db.commit()
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, "VM started")
        except Exception as exc:
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed)


@celery_app.task(bind=True, max_retries=3, name="tasks.stop_vm")
def stop_vm_task(self: Task, job_id: str, vm_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        vm = db.get(VM, vm_id)
        if not job or not vm:
            return
        _set_status(db, job, JobStatus.running, 0)
        try:
            cluster = db.get(Cluster, vm.cluster_id)
            client = ProxmoxClient(cluster)
            VMProvisioner.stop_vm(client, vm.proxmox_vmid)
            vm.status = VMStatus.stopped
            db.add(vm)
            db.commit()
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, "VM stopped")
        except Exception as exc:
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed)


@celery_app.task(bind=True, max_retries=3, name="tasks.reboot_vm")
def reboot_vm_task(self: Task, job_id: str, vm_id: str) -> None:
    with Session(engine) as db:
        job = db.get(Job, job_id)
        vm = db.get(VM, vm_id)
        if not job or not vm:
            return
        _set_status(db, job, JobStatus.running, 0)
        try:
            cluster = db.get(Cluster, vm.cluster_id)
            client = ProxmoxClient(cluster)
            VMProvisioner.reboot_vm(client, vm.proxmox_vmid)
            _set_status(db, job, JobStatus.success, 100)
            _log(db, job, "VM rebooted")
        except Exception as exc:
            try:
                raise self.retry(exc=exc, countdown=2 ** self.request.retries)
            except self.MaxRetriesExceededError:
                _set_status(db, job, JobStatus.failed)

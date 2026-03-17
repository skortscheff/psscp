from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from app.core.deps import get_db, require_admin
from app.core.encryption import encrypt, decrypt
from app.models.user import User
from app.models.cluster import Cluster
from app.models.vm import VM, VMStatus
from app.models.flavor import Flavor
from app.models.network import Network
from app.schemas.clusters import (
    ClusterCreate, ClusterUpdate, ClusterResponse,
    ClusterDetailResponse, ClusterTestResult, ClusterNodeInfo,
)
from app.schemas.common import JobResponse
from app.services.clusters import enqueue_register_cluster, enqueue_delete_cluster

router = APIRouter(prefix="/clusters", tags=["clusters"])

@router.get("", response_model=list[ClusterResponse])
def list_clusters(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    clusters = db.exec(select(Cluster).where(Cluster.is_active == True)).all()
    return clusters

@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def create_cluster(body: ClusterCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    existing = db.exec(select(Cluster).where(Cluster.name == body.name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cluster name already taken")
    return enqueue_register_cluster(db, admin, body)

@router.get("/{cluster_id}", response_model=ClusterDetailResponse)
def get_cluster(cluster_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cluster = db.get(Cluster, cluster_id)
    if not cluster or not cluster.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    vm_count = db.exec(
        select(func.count()).select_from(VM)
        .where(VM.cluster_id == cluster_id, VM.status != VMStatus.deleted)
    ).one()
    flavor_count = db.exec(
        select(func.count()).select_from(Flavor).where(Flavor.cluster_id == cluster_id)
    ).one()
    network_count = db.exec(
        select(func.count()).select_from(Network).where(Network.cluster_id == cluster_id)
    ).one()
    result = ClusterDetailResponse.model_validate(cluster)
    result.vm_count = vm_count
    result.flavor_count = flavor_count
    result.network_count = network_count
    return result

@router.patch("/{cluster_id}", response_model=ClusterResponse)
def update_cluster(cluster_id: str, body: ClusterUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cluster = db.get(Cluster, cluster_id)
    if not cluster or not cluster.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    data = body.model_dump(exclude_none=True)
    if "api_token_secret" in data:
        data["api_token_secret"] = encrypt(data["api_token_secret"])
    for field, value in data.items():
        setattr(cluster, field, value)
    db.add(cluster)
    db.commit()
    db.refresh(cluster)
    return cluster

@router.delete("/{cluster_id}", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def delete_cluster(cluster_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cluster = db.get(Cluster, cluster_id)
    if not cluster or not cluster.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    active_vms = db.exec(
        select(VM).where(VM.cluster_id == cluster_id, VM.status != VMStatus.deleted)
    ).first()
    if active_vms:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cluster has active VMs")
    return enqueue_delete_cluster(db, admin, cluster_id)

@router.get("/{cluster_id}/templates")
def list_templates(cluster_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.driver.proxmox_client import ProxmoxClient
    from app.driver.template_registry import TemplateRegistry
    cluster = db.get(Cluster, cluster_id)
    if not cluster or not cluster.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    try:
        client = ProxmoxClient(cluster)
        templates = TemplateRegistry.list_templates(client)
        return templates
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Proxmox error: {str(e)}")

@router.get("/{cluster_id}/test", response_model=ClusterTestResult)
def test_cluster(cluster_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.driver.proxmox_client import ProxmoxClient
    from app.driver.sdn_manager import SDNManager
    from app.driver.template_registry import TemplateRegistry
    cluster = db.get(Cluster, cluster_id)
    if not cluster or not cluster.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    try:
        client = ProxmoxClient(cluster)
        api = client.get_api()
    except Exception as e:
        return ClusterTestResult(success=False, error=f"Failed to connect: {str(e)}")

    result = ClusterTestResult(success=True)

    # Proxmox version
    try:
        ver = api.version.get()
        result.version = ver.get("version", "unknown")
    except Exception as e:
        result.success = False
        result.error = f"Connected but could not fetch version: {str(e)}"
        return result

    # Node list
    try:
        nodes_raw = api.nodes.get()
        for n in nodes_raw:
            result.nodes.append(ClusterNodeInfo(
                name=n.get("node", "?"),
                status=n.get("status", "unknown"),
                uptime=n.get("uptime"),
                cpu_usage=round(n.get("cpu", 0) * 100, 1),
                mem_used=n.get("mem"),
                mem_total=n.get("maxmem"),
            ))
    except Exception:
        pass  # Non-fatal; connectivity succeeded

    # SDN detection
    try:
        result.sdn_detected = SDNManager.detect_sdn(client)
    except Exception:
        pass

    # Template count
    try:
        templates = TemplateRegistry.list_templates(client)
        result.template_count = len(templates)
    except Exception:
        pass

    return result

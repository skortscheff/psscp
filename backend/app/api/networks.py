from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.core.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.network import Network, NetworkType
from app.models.cluster import Cluster
from app.models.vm import VM, VMStatus
from app.schemas.networks import NetworkCreate, NetworkResponse

router = APIRouter(prefix="/networks", tags=["networks"])

@router.get("", response_model=list[NetworkResponse])
def list_networks(cluster_id: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = select(Network)
    if cluster_id:
        q = q.where(Network.cluster_id == cluster_id)
    return db.exec(q).all()

@router.post("", status_code=status.HTTP_201_CREATED, response_model=NetworkResponse)
def create_network(body: NetworkCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cluster = db.get(Cluster, body.cluster_id)
    if not cluster or not cluster.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found")
    if body.type == NetworkType.vxlan and not cluster.sdn_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VXLAN requires SDN enabled on cluster")
    if body.type == NetworkType.vxlan and body.vxlan_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="vxlan_id required for VXLAN network")
    existing = db.exec(select(Network).where(Network.cluster_id == body.cluster_id, Network.name == body.name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Network name already taken in this cluster")
    network = Network(**body.model_dump())
    db.add(network)
    db.commit()
    db.refresh(network)
    return network

@router.get("/{network_id}", response_model=NetworkResponse)
def get_network(network_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found")
    return network

@router.delete("/{network_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_network(network_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found")
    refs = db.exec(select(VM).where(VM.network_id == network_id, VM.status != VMStatus.deleted)).first()
    if refs:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Network is attached to active VMs")
    db.delete(network)
    db.commit()

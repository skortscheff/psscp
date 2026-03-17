from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.core.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.flavor import Flavor
from app.models.vm import VM, VMStatus
from app.schemas.flavors import FlavorCreate, FlavorUpdate, FlavorResponse

router = APIRouter(prefix="/flavors", tags=["flavors"])

@router.get("", response_model=list[FlavorResponse])
def list_flavors(cluster_id: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = select(Flavor).where(Flavor.is_active == True)
    if cluster_id:
        q = q.where(Flavor.cluster_id == cluster_id)
    return db.exec(q).all()

@router.post("", status_code=status.HTTP_201_CREATED, response_model=FlavorResponse)
def create_flavor(body: FlavorCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    existing = db.exec(select(Flavor).where(Flavor.cluster_id == body.cluster_id, Flavor.name == body.name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flavor name already taken in this cluster")
    flavor = Flavor(**body.model_dump())
    db.add(flavor)
    db.commit()
    db.refresh(flavor)
    return flavor

@router.get("/{flavor_id}", response_model=FlavorResponse)
def get_flavor(flavor_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    flavor = db.get(Flavor, flavor_id)
    if not flavor or not flavor.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flavor not found")
    return flavor

@router.patch("/{flavor_id}", response_model=FlavorResponse)
def update_flavor(flavor_id: str, body: FlavorUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    flavor = db.get(Flavor, flavor_id)
    if not flavor or not flavor.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flavor not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(flavor, field, value)
    db.add(flavor)
    db.commit()
    db.refresh(flavor)
    return flavor

@router.delete("/{flavor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flavor(flavor_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    flavor = db.get(Flavor, flavor_id)
    if not flavor or not flavor.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flavor not found")
    refs = db.exec(select(VM).where(VM.flavor_id == flavor_id, VM.status != VMStatus.deleted)).first()
    if refs:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flavor is referenced by active VMs")
    flavor.is_active = False
    db.add(flavor)
    db.commit()

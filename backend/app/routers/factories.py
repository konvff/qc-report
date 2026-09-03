from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Factory
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/factories", tags=["factories"])


class FactoryCreate(BaseModel):
    name: str
    location: str | None = None


class FactoryOut(BaseModel):
    id: int
    name: str
    location: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[FactoryOut])
def list_factories(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return db.query(Factory).order_by(Factory.name).all()


@router.post("", response_model=FactoryOut)
def create_factory(payload: FactoryCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    f = Factory(name=payload.name, location=payload.location)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f

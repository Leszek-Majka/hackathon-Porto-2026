from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models import Discipline

router = APIRouter(prefix="/api/projects/{project_id}", tags=["setup"])


class DisciplineCreate(BaseModel):
    name: str
    abbreviation: str = ""
    color: str = "#6366F1"
    order_index: int = 0


class DisciplineUpdate(BaseModel):
    name: Optional[str] = None
    abbreviation: Optional[str] = None
    color: Optional[str] = None
    order_index: Optional[int] = None


class DisciplineResponse(BaseModel):
    id: int
    project_id: int
    name: str
    abbreviation: str
    color: str
    order_index: int
    model_config = {"from_attributes": True}


@router.get("/disciplines", response_model=List[DisciplineResponse])
def list_disciplines(project_id: int, db: Session = Depends(get_db)):
    return db.query(Discipline).filter(Discipline.project_id == project_id).order_by(Discipline.order_index).all()


@router.post("/disciplines", response_model=DisciplineResponse)
def create_discipline(project_id: int, body: DisciplineCreate, db: Session = Depends(get_db)):
    d = Discipline(project_id=project_id, **body.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.put("/disciplines/{did}", response_model=DisciplineResponse)
def update_discipline(project_id: int, did: int, body: DisciplineUpdate, db: Session = Depends(get_db)):
    d = db.query(Discipline).filter(Discipline.id == did, Discipline.project_id == project_id).first()
    if not d:
        raise HTTPException(404, "Discipline not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/disciplines/{did}")
def delete_discipline(project_id: int, did: int, db: Session = Depends(get_db)):
    d = db.query(Discipline).filter(Discipline.id == did, Discipline.project_id == project_id).first()
    if not d:
        raise HTTPException(404, "Discipline not found")
    db.delete(d)
    db.commit()
    return {"ok": True}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models import Discipline

router = APIRouter(prefix="/api/projects/{project_id}", tags=["setup"])

DISCIPLINE_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
    "#F97316", "#6366F1", "#14B8A6", "#A855F7",
    "#22C55E", "#EAB308", "#0EA5E9", "#F43F5E",
    "#64748B", "#D97706", "#7C3AED", "#0891B2",
]


class DisciplineCreate(BaseModel):
    name: str
    abbreviation: str = ""
    color: Optional[str] = None
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
    existing = db.query(Discipline).filter(Discipline.project_id == project_id).all()
    existing_colors = {d.color for d in existing}
    if body.color:
        color = body.color
    else:
        # Pick first palette color not yet in use; fall back to cycling by count
        color = next(
            (c for c in DISCIPLINE_COLORS if c not in existing_colors),
            DISCIPLINE_COLORS[len(existing) % len(DISCIPLINE_COLORS)],
        )
    data = body.model_dump(exclude={"color"})
    d = Discipline(project_id=project_id, color=color, **data)
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

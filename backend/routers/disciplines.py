from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Project, Discipline
from schemas import DisciplineCreate, DisciplineUpdate, DisciplineResponse

router = APIRouter(tags=["disciplines"])

DEFAULT_DISCIPLINES = [
    {"code": "ARCH",   "name": "Architecture",  "color": "#3b9eff", "order_index": 0},
    {"code": "STRUCT", "name": "Structural",     "color": "#f4a031", "order_index": 1},
    {"code": "MEP",    "name": "MEP",            "color": "#00c8a0", "order_index": 2},
    {"code": "CIVIL",  "name": "Civil / Site",   "color": "#b07ee8", "order_index": 3},
]


@router.get("/api/projects/{project_id}/disciplines", response_model=List[DisciplineResponse])
def list_disciplines(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Discipline).filter(Discipline.project_id == project_id).order_by(Discipline.order_index).all()


@router.post("/api/projects/{project_id}/disciplines", response_model=DisciplineResponse)
def create_discipline(project_id: int, data: DisciplineCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    d = Discipline(
        project_id=project_id,
        name=data.name,
        code=data.code,
        color=data.color or "#3b9eff",
        order_index=data.order_index or 0,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.post("/api/projects/{project_id}/disciplines/seed", response_model=List[DisciplineResponse])
def seed_disciplines(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = db.query(Discipline).filter(Discipline.project_id == project_id).count()
    if existing > 0:
        raise HTTPException(status_code=400, detail="Disciplines already exist for this project")

    created = []
    for d_data in DEFAULT_DISCIPLINES:
        d = Discipline(project_id=project_id, **d_data)
        db.add(d)
        created.append(d)
    db.commit()
    for d in created:
        db.refresh(d)
    return created


@router.patch("/api/disciplines/{discipline_id}", response_model=DisciplineResponse)
def update_discipline(discipline_id: int, data: DisciplineUpdate, db: Session = Depends(get_db)):
    d = db.query(Discipline).filter(Discipline.id == discipline_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discipline not found")
    if data.name is not None:
        d.name = data.name
    if data.code is not None:
        d.code = data.code
    if data.color is not None:
        d.color = data.color
    if data.order_index is not None:
        d.order_index = data.order_index
    db.commit()
    db.refresh(d)
    return d


@router.delete("/api/disciplines/{discipline_id}")
def delete_discipline(discipline_id: int, db: Session = Depends(get_db)):
    d = db.query(Discipline).filter(Discipline.id == discipline_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discipline not found")
    db.delete(d)
    db.commit()
    return {"ok": True}

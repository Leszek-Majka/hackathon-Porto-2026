from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Project, Phase
from schemas import PhaseCreate, PhaseUpdate, PhaseResponse

router = APIRouter(prefix="/api/projects", tags=["phases"])

PHASE_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
    "#F97316", "#6366F1", "#14B8A6", "#A855F7",
    "#22C55E", "#EAB308", "#0EA5E9", "#F43F5E",
    "#64748B", "#D97706", "#7C3AED", "#0891B2",
]


def _phase_to_dict(phase: Phase) -> dict:
    return {
        "id": phase.id,
        "project_id": phase.project_id,
        "name": phase.name,
        "color": phase.color,
        "order_index": phase.order_index,
        "created_at": phase.created_at.isoformat(),
    }


@router.get("/{project_id}/phases", response_model=None)
def list_phases(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    phases = sorted(project.phases, key=lambda p: p.order_index)
    return [_phase_to_dict(p) for p in phases]


@router.post("/{project_id}/phases", response_model=None)
def add_phase(project_id: int, data: PhaseCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Auto-assign color — pick first unused palette color, fall back to cycling
    existing_colors = {p.color for p in project.phases}
    phase_count = len(project.phases)
    color = data.color or next(
        (c for c in PHASE_COLORS if c not in existing_colors),
        PHASE_COLORS[phase_count % len(PHASE_COLORS)],
    )
    order_index = data.order_index if data.order_index is not None else phase_count

    phase = Phase(
        project_id=project_id,
        name=data.name,
        color=color,
        order_index=order_index,
    )
    db.add(phase)
    db.commit()
    db.refresh(phase)
    return _phase_to_dict(phase)


@router.put("/{project_id}/phases/{phase_id}", response_model=None)
def update_phase(project_id: int, phase_id: int, data: PhaseUpdate, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")

    if data.name is not None:
        phase.name = data.name
    if data.color is not None:
        phase.color = data.color
    if data.order_index is not None:
        phase.order_index = data.order_index

    db.commit()
    db.refresh(phase)
    return _phase_to_dict(phase)


@router.delete("/{project_id}/phases/{phase_id}")
def delete_phase(project_id: int, phase_id: int, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    db.delete(phase)
    db.commit()
    return {"ok": True}

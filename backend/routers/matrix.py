import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Project, PhaseMatrix
from schemas import MatrixCellUpdate

router = APIRouter(prefix="/api/projects", tags=["matrix"])


@router.get("/{project_id}/matrix", response_model=None)
def get_matrix(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    entries = db.query(PhaseMatrix).filter(PhaseMatrix.project_id == project_id).all()

    # Build a nested structure: {spec_id: {req_key: {phase_id: status}}}
    matrix: dict = {}
    for entry in entries:
        if entry.spec_id not in matrix:
            matrix[entry.spec_id] = {}
        if entry.requirement_key not in matrix[entry.spec_id]:
            matrix[entry.spec_id][entry.requirement_key] = {}
        matrix[entry.spec_id][entry.requirement_key][str(entry.phase_id)] = entry.status

    return {
        "project_id": project_id,
        "matrix": matrix,
        "entries": [
            {
                "id": e.id,
                "project_id": e.project_id,
                "spec_id": e.spec_id,
                "requirement_key": e.requirement_key,
                "phase_id": e.phase_id,
                "status": e.status,
            }
            for e in entries
        ],
    }


@router.put("/{project_id}/matrix", response_model=None)
def update_matrix_cell(project_id: int, data: MatrixCellUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.status not in ("required", "optional", "excluded"):
        raise HTTPException(status_code=400, detail="Status must be required, optional, or excluded")

    entry = db.query(PhaseMatrix).filter(
        PhaseMatrix.project_id == project_id,
        PhaseMatrix.spec_id == data.spec_id,
        PhaseMatrix.requirement_key == data.requirement_key,
        PhaseMatrix.phase_id == data.phase_id,
    ).first()

    if entry:
        entry.status = data.status
    else:
        entry = PhaseMatrix(
            project_id=project_id,
            spec_id=data.spec_id,
            requirement_key=data.requirement_key,
            phase_id=data.phase_id,
            status=data.status,
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id,
        "project_id": entry.project_id,
        "spec_id": entry.spec_id,
        "requirement_key": entry.requirement_key,
        "phase_id": entry.phase_id,
        "status": entry.status,
    }

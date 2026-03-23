"""Validation router — IFC upload and validation runs."""
import asyncio
import json
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models import Project, IFCFile, Phase, PhaseMatrix, ValidationRun
from ifc_validator import validate_ifc, get_ifc_info

router = APIRouter(prefix="/api/projects", tags=["validation"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500 MB


def _uploads_path(project_id: int) -> str:
    path = os.path.join(UPLOAD_DIR, str(project_id))
    os.makedirs(path, exist_ok=True)
    return path


def _ifc_to_dict(ifc: IFCFile) -> dict:
    return {
        "id": ifc.id,
        "project_id": ifc.project_id,
        "filename": ifc.filename,
        "ifc_schema": ifc.ifc_schema,
        "element_count": ifc.element_count,
        "uploaded_at": ifc.uploaded_at.isoformat(),
    }


# ── IFC Upload ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/upload-ifc", response_model=None)
async def upload_ifc(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 500 MB)")

    dest_dir = _uploads_path(project_id)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename or 'model.ifc'}"
    dest_path = os.path.join(dest_dir, safe_name)
    with open(dest_path, "wb") as f:
        f.write(content)

    info = get_ifc_info(dest_path)
    ifc = IFCFile(
        project_id=project_id,
        filename=file.filename or "model.ifc",
        file_path=dest_path,
        ifc_schema=info.get("ifc_schema", ""),
        element_count=info.get("element_count", 0),
    )
    db.add(ifc)
    db.commit()
    db.refresh(ifc)

    return _ifc_to_dict(ifc)


@router.get("/{project_id}/ifc-files", response_model=None)
def list_ifc_files(project_id: int, db: Session = Depends(get_db)):
    files = db.query(IFCFile).filter(IFCFile.project_id == project_id).order_by(IFCFile.uploaded_at.desc()).all()
    return [_ifc_to_dict(f) for f in files]


@router.delete("/{project_id}/ifc-files/{fid}", response_model=None)
def delete_ifc_file(project_id: int, fid: int, db: Session = Depends(get_db)):
    ifc = db.query(IFCFile).filter(IFCFile.id == fid, IFCFile.project_id == project_id).first()
    if not ifc:
        raise HTTPException(404, "IFC file not found")
    if os.path.exists(ifc.file_path):
        os.remove(ifc.file_path)
    db.delete(ifc)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/ifc-info", response_model=None)
def get_ifc_info_route(project_id: int, db: Session = Depends(get_db)):
    ifc = db.query(IFCFile).filter(IFCFile.project_id == project_id).order_by(IFCFile.uploaded_at.desc()).first()
    if not ifc:
        raise HTTPException(status_code=404, detail="No IFC file uploaded")
    return _ifc_to_dict(ifc)


# ── Validation ────────────────────────────────────────────────────────────────

async def _run_validation_bg(run_id: int, ifc_path: str, parsed_ids: dict, phase_matrix: dict):
    """Background task: run validation and update DB."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        run = db.query(ValidationRun).filter(ValidationRun.id == run_id).first()
        if not run:
            return
        run.status = "running"
        db.commit()

        result = await asyncio.to_thread(validate_ifc, ifc_path, parsed_ids, phase_matrix)

        run.status = "complete"
        run.summary_json = json.dumps(result.get("summary", {}))
        run.results_json = json.dumps({"specs": result.get("specs", [])})
        if result.get("error"):
            run.status = "error"
            run.error_message = result["error"]
        db.commit()
    except Exception as e:
        db = SessionLocal()
        run = db.query(ValidationRun).filter(ValidationRun.id == run_id).first()
        if run:
            run.status = "error"
            run.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/{project_id}/validate/{phase_id}", response_model=None)
async def start_validation(project_id: int, phase_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ifc_file = db.query(IFCFile).filter(IFCFile.project_id == project_id).order_by(IFCFile.uploaded_at.desc()).first()
    if not ifc_file:
        raise HTTPException(status_code=400, detail="No IFC file uploaded")
    if not project.ids_file:
        raise HTTPException(status_code=400, detail="No IDS file uploaded")

    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")

    # Build phase matrix
    entries = db.query(PhaseMatrix).filter(
        PhaseMatrix.project_id == project_id,
        PhaseMatrix.phase_id == phase_id,
    ).all()
    phase_matrix: dict = {}
    for e in entries:
        if e.spec_id not in phase_matrix:
            phase_matrix[e.spec_id] = {}
        phase_matrix[e.spec_id][e.requirement_key] = e.status

    parsed_ids = json.loads(project.ids_file.parsed_json)

    run = ValidationRun(
        project_id=project_id,
        phase_id=phase_id,
        ifc_file_id=ifc_file.id,
        status="pending",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    asyncio.create_task(_run_validation_bg(run.id, ifc_file.file_path, parsed_ids, phase_matrix))

    return {"run_id": run.id, "status": run.status}


@router.get("/{project_id}/validations", response_model=None)
def list_validations(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    runs = db.query(ValidationRun).filter(ValidationRun.project_id == project_id).order_by(ValidationRun.run_at.desc()).all()
    return [_run_to_dict(r) for r in runs]


@router.get("/{project_id}/validations/{run_id}", response_model=None)
def get_validation(project_id: int, run_id: int, db: Session = Depends(get_db)):
    run = db.query(ValidationRun).filter(
        ValidationRun.id == run_id, ValidationRun.project_id == project_id
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Validation run not found")
    return _run_to_dict(run, include_results=True)


@router.delete("/{project_id}/validations/{run_id}")
def delete_validation(project_id: int, run_id: int, db: Session = Depends(get_db)):
    run = db.query(ValidationRun).filter(
        ValidationRun.id == run_id, ValidationRun.project_id == project_id
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Validation run not found")
    db.delete(run)
    db.commit()
    return {"ok": True}


def _run_to_dict(run: ValidationRun, include_results: bool = False) -> dict:
    d = {
        "id": run.id,
        "project_id": run.project_id,
        "phase_id": run.phase_id,
        "ifc_file_id": run.ifc_file_id,
        "status": run.status,
        "run_at": run.run_at.isoformat(),
        "summary": json.loads(run.summary_json or "{}"),
        "error_message": run.error_message or "",
    }
    if include_results:
        d["results"] = json.loads(run.results_json or "{}")
    return d

import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Project, IDSFile, Phase, PhaseMatrix
from schemas import ProjectCreate, ProjectResponse, ProjectDetail, IDSFileResponse
from ids_parser import parse_ids_to_json, parse_ids

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project_to_detail(project: Project) -> dict:
    ids_data = None
    spec_count = 0
    if project.ids_file:
        ids_data = {
            "id": project.ids_file.id,
            "project_id": project.ids_file.project_id,
            "filename": project.ids_file.filename,
            "parsed_json": project.ids_file.parsed_json,
            "uploaded_at": project.ids_file.uploaded_at.isoformat(),
        }
        parsed = json.loads(project.ids_file.parsed_json)
        spec_count = len(parsed.get("specifications", []))

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description or "",
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat() if project.updated_at else project.created_at.isoformat(),
        "ids_file": ids_data,
        "phases": [
            {
                "id": p.id,
                "project_id": p.project_id,
                "name": p.name,
                "color": p.color,
                "order_index": p.order_index,
                "created_at": p.created_at.isoformat(),
            }
            for p in project.phases
        ],
        "spec_count": spec_count,
        "phase_count": len(project.phases),
    }


@router.post("", response_model=None)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=data.name, description=data.description or "")
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_detail(project)


@router.get("", response_model=None)
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [_project_to_detail(p) for p in projects]


@router.get("/{project_id}", response_model=None)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_detail(project)


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/upload", response_model=None)
async def upload_ids(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    xml_content = content.decode("utf-8")

    try:
        parsed_json = parse_ids_to_json(xml_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse IDS file: {str(e)}")

    # Remove existing ids file if any
    if project.ids_file:
        db.delete(project.ids_file)
        db.flush()

    ids_file = IDSFile(
        project_id=project_id,
        filename=file.filename or "upload.ids",
        raw_xml=xml_content,
        parsed_json=parsed_json,
    )
    db.add(ids_file)
    db.commit()
    db.refresh(ids_file)

    return {
        "id": ids_file.id,
        "project_id": ids_file.project_id,
        "filename": ids_file.filename,
        "parsed_json": ids_file.parsed_json,
        "uploaded_at": ids_file.uploaded_at.isoformat(),
    }


@router.get("/{project_id}/ids", response_model=None)
def get_ids(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.ids_file:
        raise HTTPException(status_code=404, detail="No IDS file uploaded")
    parsed = json.loads(project.ids_file.parsed_json)
    return parsed

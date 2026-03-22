from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import json
from database import get_db
from models import IDSSource
from ids_parser import parse_ids

router = APIRouter(prefix="/api/projects/{project_id}", tags=["sources"])


class SourceResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    title: str
    author: str
    date: str
    version: str
    spec_count: int
    uploaded_at: str
    model_config = {"from_attributes": True}


def _source_to_response(s: IDSSource) -> dict:
    parsed = json.loads(s.parsed_json)
    return {
        "id": s.id,
        "project_id": s.project_id,
        "filename": s.filename,
        "title": s.title,
        "author": s.author,
        "date": s.date,
        "version": s.version,
        "spec_count": len(parsed.get("specifications", [])),
        "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else "",
    }


@router.get("/sources")
def list_sources(project_id: int, db: Session = Depends(get_db)):
    sources = db.query(IDSSource).filter(IDSSource.project_id == project_id).all()
    return [_source_to_response(s) for s in sources]


@router.post("/sources")
def upload_source(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read().decode("utf-8")
    parsed = parse_ids(content)
    info = parsed.get("info", {})
    parsed_json = json.dumps(parsed, ensure_ascii=False)
    s = IDSSource(
        project_id=project_id,
        filename=file.filename,
        title=info.get("title") or "",
        author=info.get("author") or "",
        date=info.get("date") or "",
        version=info.get("version") or "",
        raw_xml=content,
        parsed_json=parsed_json,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _source_to_response(s)


@router.get("/sources/{sid}")
def get_source(project_id: int, sid: int, db: Session = Depends(get_db)):
    s = db.query(IDSSource).filter(IDSSource.id == sid, IDSSource.project_id == project_id).first()
    if not s:
        raise HTTPException(404, "Source not found")
    parsed = json.loads(s.parsed_json)
    result = _source_to_response(s)
    result["parsed"] = parsed
    return result


@router.delete("/sources/{sid}")
def delete_source(project_id: int, sid: int, db: Session = Depends(get_db)):
    s = db.query(IDSSource).filter(IDSSource.id == sid, IDSSource.project_id == project_id).first()
    if not s:
        raise HTTPException(404, "Source not found")
    db.delete(s)
    db.commit()
    return {"ok": True}

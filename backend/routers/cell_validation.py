"""Cell-based IFC validation — validate a specific discipline × phase cell against an IFC file."""
import asyncio
import json
import os
import uuid
import zipfile
import io
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import CellValidation, IFCFile, MatrixCell, Discipline, Phase
from ifc_validator import validate_ifc_from_entries

router = APIRouter(prefix="/api/projects/{project_id}", tags=["cell-validation"])


class StartCellValidation(BaseModel):
    ifc_file_id: int
    discipline_id: int
    phase_id: int


def _cv_to_dict(cv: CellValidation, include_results: bool = False) -> dict:
    d = {
        "id": cv.id,
        "project_id": cv.project_id,
        "ifc_file_id": cv.ifc_file_id,
        "discipline_id": cv.discipline_id,
        "phase_id": cv.phase_id,
        "status": cv.status,
        "run_at": cv.run_at.isoformat() if cv.run_at else None,
        "summary": json.loads(cv.summary_json or "{}"),
        "error_message": cv.error_message or "",
    }
    if include_results:
        d["specs"] = json.loads(cv.results_json or "[]")
    return d


async def _run_cell_validation_bg(cv_id: int, ifc_path: str, entries_data: list):
    db = SessionLocal()
    try:
        cv = db.query(CellValidation).filter(CellValidation.id == cv_id).first()
        if not cv:
            return
        cv.status = "running"
        db.commit()

        result = await asyncio.to_thread(validate_ifc_from_entries, ifc_path, entries_data)

        if result.get("error"):
            cv.status = "error"
            cv.error_message = result["error"]
        else:
            cv.status = "complete"
            cv.summary_json = json.dumps(result.get("summary", {}))
            cv.results_json = json.dumps(result.get("specs", []))
        db.commit()
    except Exception as e:
        try:
            cv = db.query(CellValidation).filter(CellValidation.id == cv_id).first()
            if cv:
                cv.status = "error"
                cv.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/cell-validations", response_model=None)
async def start_cell_validation(project_id: int, body: StartCellValidation, db: Session = Depends(get_db)):
    ifc = db.query(IFCFile).filter(IFCFile.id == body.ifc_file_id, IFCFile.project_id == project_id).first()
    if not ifc:
        raise HTTPException(404, "IFC file not found")

    disc = db.query(Discipline).filter(Discipline.id == body.discipline_id, Discipline.project_id == project_id).first()
    phase = db.query(Phase).filter(Phase.id == body.phase_id, Phase.project_id == project_id).first()
    if not disc or not phase:
        raise HTTPException(404, "Discipline or phase not found")

    cell = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=body.discipline_id, phase_id=body.phase_id
    ).first()

    entries_data = []
    if cell:
        for e in cell.entries:
            entries_data.append({
                "spec_name": e.spec_name,
                "applicability": json.loads(e.applicability_json),
                "requirement": json.loads(e.requirement_json),
                "status": e.status,
            })

    cv = CellValidation(
        project_id=project_id,
        ifc_file_id=body.ifc_file_id,
        discipline_id=body.discipline_id,
        phase_id=body.phase_id,
        status="pending",
    )
    db.add(cv)
    db.commit()
    db.refresh(cv)

    asyncio.create_task(_run_cell_validation_bg(cv.id, ifc.file_path, entries_data))

    return _cv_to_dict(cv)


@router.get("/cell-validations", response_model=None)
def list_cell_validations(
    project_id: int,
    ifc_file_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(CellValidation).filter(CellValidation.project_id == project_id)
    if ifc_file_id:
        q = q.filter(CellValidation.ifc_file_id == ifc_file_id)
    runs = q.order_by(CellValidation.run_at.desc()).all()
    return [_cv_to_dict(r) for r in runs]


@router.get("/cell-validations/{vid}", response_model=None)
def get_cell_validation(project_id: int, vid: int, db: Session = Depends(get_db)):
    cv = db.query(CellValidation).filter(CellValidation.id == vid, CellValidation.project_id == project_id).first()
    if not cv:
        raise HTTPException(404, "Validation not found")
    return _cv_to_dict(cv, include_results=True)


@router.delete("/cell-validations/{vid}", response_model=None)
def delete_cell_validation(project_id: int, vid: int, db: Session = Depends(get_db)):
    cv = db.query(CellValidation).filter(CellValidation.id == vid, CellValidation.project_id == project_id).first()
    if not cv:
        raise HTTPException(404, "Validation not found")
    db.delete(cv)
    db.commit()
    return {"ok": True}


@router.get("/cell-validations/{vid}/bcf", response_model=None)
def download_bcf(project_id: int, vid: int, db: Session = Depends(get_db)):
    cv = db.query(CellValidation).filter(CellValidation.id == vid, CellValidation.project_id == project_id).first()
    if not cv or cv.status != "complete":
        raise HTTPException(404, "Validation not found or not complete")

    disc = db.query(Discipline).filter(Discipline.id == cv.discipline_id).first()
    phase = db.query(Phase).filter(Phase.id == cv.phase_id).first()
    ifc = db.query(IFCFile).filter(IFCFile.id == cv.ifc_file_id).first()

    specs = json.loads(cv.results_json or "[]")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # bcf.version
        zf.writestr(
            "bcf.version",
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Version VersionId="2.1" xsi:noNamespaceSchemaLocation="version.xsd" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
            '  <DetailedVersion>2.1</DetailedVersion>\n</Version>',
        )
        # project.bcfp
        proj_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<ProjectExtension xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
            'xsi:noNamespaceSchemaLocation="project.xsd">\n'
            f'  <Project ProjectId="{uuid.uuid4()}">\n'
            f'    <Name>IDS Validation — {disc.name if disc else ""} × {phase.name if phase else ""}</Name>\n'
            '  </Project>\n</ProjectExtension>'
        )
        zf.writestr("project.bcfp", proj_xml)

        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
        for spec in specs:
            spec_name = spec.get("spec_name", "Unknown spec")
            for failure in spec.get("failures", []):
                topic_guid = str(uuid.uuid4())
                global_id = failure.get("global_id", "")
                element_type = failure.get("element_type", "")
                element_name = failure.get("element_name", "") or failure.get("element_id", "")
                failed_reqs = ", ".join(failure.get("failed_requirements", []))
                title = f"{element_type} '{element_name}' — {spec_name}"
                description = (
                    f"GlobalId: {global_id}\n"
                    f"Failed requirements: {failed_reqs}\n"
                    f"IFC file: {ifc.filename if ifc else ''}"
                )
                markup = (
                    '<?xml version="1.0" encoding="UTF-8"?>\n'
                    '<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                    'xsi:noNamespaceSchemaLocation="markup.xsd">\n'
                    f'  <Topic Guid="{topic_guid}" TopicType="Issue" TopicStatus="Open">\n'
                    f'    <Title>{title}</Title>\n'
                    f'    <Description>{description}</Description>\n'
                    f'    <CreationDate>{now_str}</CreationDate>\n'
                    '    <CreationAuthor>IDS Validator</CreationAuthor>\n'
                    '    <Labels>IDS</Labels>\n'
                    f'    <Labels>{spec_name}</Labels>\n'
                    '  </Topic>\n</Markup>'
                )
                zf.writestr(f"{topic_guid}/markup.bcf", markup)

    buf.seek(0)
    disc_name = disc.name if disc else "disc"
    phase_name = phase.name if phase else "phase"
    filename = f"validation_{disc_name}_{phase_name}.bcf"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

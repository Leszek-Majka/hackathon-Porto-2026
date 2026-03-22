import io
import json
import zipfile
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Phase, PhaseMatrix
from ids_exporter import export_phase, slugify

router = APIRouter(prefix="/api/projects", tags=["export"])


@router.get("/{project_id}/export/{phase_id}")
def export_single_phase(project_id: int, phase_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.ids_file:
        raise HTTPException(status_code=404, detail="No IDS file uploaded")

    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")

    matrix_entries = db.query(PhaseMatrix).filter(
        PhaseMatrix.project_id == project_id,
        PhaseMatrix.phase_id == phase_id,
    ).all()

    xml_content = export_phase(
        raw_xml=project.ids_file.raw_xml,
        parsed_json=project.ids_file.parsed_json,
        phase_name=phase.name,
        matrix_entries=matrix_entries,
        phase_id=phase_id,
    )

    proj_slug = slugify(project.name)
    phase_slug = slugify(phase.name)
    filename = f"{proj_slug}_{phase_slug}.ids"

    return Response(
        content=xml_content.encode("utf-8"),
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/export")
def export_all_phases(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.ids_file:
        raise HTTPException(status_code=404, detail="No IDS file uploaded")
    if not project.phases:
        raise HTTPException(status_code=400, detail="No phases defined")

    all_matrix_entries = db.query(PhaseMatrix).filter(
        PhaseMatrix.project_id == project_id,
    ).all()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for phase in project.phases:
            phase_entries = [e for e in all_matrix_entries if e.phase_id == phase.id]
            xml_content = export_phase(
                raw_xml=project.ids_file.raw_xml,
                parsed_json=project.ids_file.parsed_json,
                phase_name=phase.name,
                matrix_entries=phase_entries,
                phase_id=phase.id,
            )
            proj_slug = slugify(project.name)
            phase_slug = slugify(phase.name)
            zf.writestr(f"{proj_slug}_{phase_slug}.ids", xml_content.encode("utf-8"))

    zip_buffer.seek(0)
    proj_slug = slugify(project.name)
    today = date.today().isoformat()
    zip_filename = f"{proj_slug}_all-phases_{today}.zip"

    return Response(
        content=zip_buffer.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )

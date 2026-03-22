from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
import json, zipfile, io, re
from datetime import date
from database import get_db
from models import MatrixCell, CellEntry, Discipline, Phase

router = APIRouter(prefix="/api/projects/{project_id}", tags=["export"])

IDS_NS = "http://standards.buildingsmart.org/IDS"
XSD_NS = "http://www.w3.org/2001/XMLSchema"


def _slugify(text: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]+', '_', text).strip('_')


def _status_to_occurs(status: str) -> tuple:
    if status == "required":
        return ("1", "unbounded")
    elif status == "prohibited":
        return ("0", "0")
    else:  # optional
        return ("0", "unbounded")


def _build_ids_xml(header: dict, entries: list) -> str:
    title = header.get("title", "IDS Export")
    author = header.get("author", "")
    ids_date = header.get("date", str(date.today()))
    version = header.get("version", "")
    description = header.get("description", "")
    copyright_text = header.get("copyright", "")

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<ids:ids xmlns:ids="{IDS_NS}" xmlns:xs="{XSD_NS}">',
        '  <ids:info>',
        f'    <ids:title>{title}</ids:title>',
    ]
    if copyright_text:
        lines.append(f'    <ids:copyright>{copyright_text}</ids:copyright>')
    if version:
        lines.append(f'    <ids:version>{version}</ids:version>')
    if description:
        lines.append(f'    <ids:description>{description}</ids:description>')
    if author:
        lines.append(f'    <ids:author>{author}</ids:author>')
    if ids_date:
        lines.append(f'    <ids:date>{ids_date}</ids:date>')
    lines.append('  </ids:info>')
    lines.append('  <ids:specifications>')

    # Group entries by (spec_name, group_key)
    from collections import defaultdict
    groups: dict = defaultdict(list)
    for entry in entries:
        key = (entry["spec_name"], entry["group_key"])
        groups[key].append(entry)

    spec_name_groups: dict = defaultdict(list)
    for (spec_name, gkey), group_entries in groups.items():
        spec_name_groups[spec_name].append((gkey, group_entries))

    for spec_name, gkey_groups in spec_name_groups.items():
        all_entries = [e for _, g in gkey_groups for e in g]
        applicability = all_entries[0].get("applicability", [{}]) if all_entries else [{}]
        appl = applicability[0] if applicability else {}

        lines.append(f'  <ids:specification name="{spec_name}">')
        lines.append('    <ids:applicability>')
        entity = appl.get("entity", {})
        if entity:
            name_c = entity.get("name", {})
            predef_c = entity.get("predefinedType", {})
            lines.append('      <ids:entity>')
            if name_c:
                val = name_c.get("value") or (name_c.get("values", [""])[0] if name_c.get("values") else "")
                lines.append(f'        <ids:name><ids:simpleValue>{val}</ids:simpleValue></ids:name>')
            if predef_c and predef_c.get("value"):
                lines.append(f'        <ids:predefinedType><ids:simpleValue>{predef_c["value"]}</ids:simpleValue></ids:predefinedType>')
            lines.append('      </ids:entity>')
        lines.append('    </ids:applicability>')
        lines.append('    <ids:requirements>')

        for entry in all_entries:
            req = entry.get("requirement", {})
            status = entry.get("status", "required")
            min_o, max_o = _status_to_occurs(status)
            req_type = req.get("type", "attribute")

            if req_type == "attribute":
                name_c = req.get("name", {})
                name_val = name_c.get("value", "") if name_c else ""
                lines.append(f'      <ids:attribute minOccurs="{min_o}" maxOccurs="{max_o}">')
                lines.append(f'        <ids:name><ids:simpleValue>{name_val}</ids:simpleValue></ids:name>')
                lines.append('      </ids:attribute>')
            elif req_type == "property":
                ps_c = req.get("propertySet", {})
                bn_c = req.get("baseName", {})
                ps_val = ps_c.get("value", "") if ps_c else ""
                bn_val = bn_c.get("value", "") if bn_c else ""
                lines.append(f'      <ids:property minOccurs="{min_o}" maxOccurs="{max_o}">')
                lines.append(f'        <ids:propertySet><ids:simpleValue>{ps_val}</ids:simpleValue></ids:propertySet>')
                lines.append(f'        <ids:baseName><ids:simpleValue>{bn_val}</ids:simpleValue></ids:baseName>')
                lines.append('      </ids:property>')
            elif req_type == "material":
                lines.append(f'      <ids:material minOccurs="{min_o}" maxOccurs="{max_o}"/>')
            elif req_type == "classification":
                sys_c = req.get("system", {})
                sys_val = sys_c.get("value", "") if sys_c else ""
                lines.append(f'      <ids:classification minOccurs="{min_o}" maxOccurs="{max_o}">')
                if sys_val:
                    lines.append(f'        <ids:system><ids:simpleValue>{sys_val}</ids:simpleValue></ids:system>')
                lines.append('      </ids:classification>')

        lines.append('    </ids:requirements>')
        lines.append('  </ids:specification>')

    lines.append('  </ids:specifications>')
    lines.append('</ids:ids>')
    return "\n".join(lines)


def _get_cell_data(project_id: int, discipline_id: int, phase_id: int, db: Session):
    cell = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=discipline_id, phase_id=phase_id
    ).first()
    if not cell:
        return {}, []
    header = json.loads(cell.header_json)
    entries = []
    for e in cell.entries:
        entries.append({
            "spec_name": e.spec_name,
            "applicability": json.loads(e.applicability_json),
            "requirement": json.loads(e.requirement_json),
            "status": e.status,
            "group_key": e.group_key,
        })
    return header, entries


@router.get("/export/cell/{did}/{pid}")
def export_cell(project_id: int, did: int, pid: int, db: Session = Depends(get_db)):
    discipline = db.query(Discipline).filter(Discipline.id == did).first()
    phase = db.query(Phase).filter(Phase.id == pid).first()
    if not discipline or not phase:
        raise HTTPException(404, "Discipline or phase not found")
    header, entries = _get_cell_data(project_id, did, pid, db)
    if not header:
        header = {"title": f"{discipline.name} — {phase.name}"}
    xml = _build_ids_xml(header, entries)
    filename = f"{_slugify(discipline.name)}_{_slugify(phase.name)}.ids"
    return Response(content=xml, media_type="application/xml", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/export/discipline/{did}")
def export_discipline(project_id: int, did: int, db: Session = Depends(get_db)):
    discipline = db.query(Discipline).filter(Discipline.id == did).first()
    if not discipline:
        raise HTTPException(404, "Discipline not found")
    phases = db.query(Phase).filter(Phase.project_id == project_id).order_by(Phase.order_index).all()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for phase in phases:
            header, entries = _get_cell_data(project_id, did, phase.id, db)
            if not header:
                header = {"title": f"{discipline.name} — {phase.name}"}
            xml = _build_ids_xml(header, entries)
            zf.writestr(f"{_slugify(discipline.name)}_{_slugify(phase.name)}.ids", xml)
    buf.seek(0)
    zipname = f"{_slugify(discipline.name)}_all-phases.zip"
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{zipname}"'})


@router.get("/export/phase/{pid}")
def export_phase(project_id: int, pid: int, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == pid).first()
    if not phase:
        raise HTTPException(404, "Phase not found")
    disciplines = db.query(Discipline).filter(Discipline.project_id == project_id).order_by(Discipline.order_index).all()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for disc in disciplines:
            header, entries = _get_cell_data(project_id, disc.id, pid, db)
            if not header:
                header = {"title": f"{disc.name} — {phase.name}"}
            xml = _build_ids_xml(header, entries)
            zf.writestr(f"{_slugify(disc.name)}_{_slugify(phase.name)}.ids", xml)
    buf.seek(0)
    zipname = f"{_slugify(phase.name)}_all-disciplines.zip"
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{zipname}"'})


@router.get("/export/all")
def export_all(project_id: int, db: Session = Depends(get_db)):
    disciplines = db.query(Discipline).filter(Discipline.project_id == project_id).order_by(Discipline.order_index).all()
    phases = db.query(Phase).filter(Phase.project_id == project_id).order_by(Phase.order_index).all()
    today = str(date.today())
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for disc in disciplines:
            for phase in phases:
                header, entries = _get_cell_data(project_id, disc.id, phase.id, db)
                if not header:
                    header = {"title": f"{disc.name} — {phase.name}"}
                xml = _build_ids_xml(header, entries)
                fname = f"{_slugify(disc.name)}/{_slugify(disc.name)}_{_slugify(phase.name)}.ids"
                zf.writestr(fname, xml)
    buf.seek(0)
    zipname = f"ids-matrix-export-{today}.zip"
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{zipname}"'})

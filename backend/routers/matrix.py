from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
import json, uuid
from database import get_db
from models import MatrixCell, CellEntry, IDSSource, Discipline, Phase

router = APIRouter(prefix="/api/projects/{project_id}", tags=["matrix"])


class HeaderUpdate(BaseModel):
    title: str = ""
    author: str = ""
    date: str = ""
    version: str = ""
    description: str = ""
    copyright: str = ""


class DropPayload(BaseModel):
    source_ids_id: int
    drop_type: str  # specification | applicability | requirement | ids | multi_specification
    spec_name: str = ""
    spec_names: List[str] = []   # for multi_specification and ids drops
    applicability_index: Optional[int] = None
    requirement_index: Optional[int] = None
    apply_to_all_phases: bool = False


class StatusUpdate(BaseModel):
    status: str  # required | optional | prohibited


def _get_or_create_cell(project_id: int, discipline_id: int, phase_id: int, db: Session) -> MatrixCell:
    cell = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=discipline_id, phase_id=phase_id
    ).first()
    if not cell:
        cell = MatrixCell(
            project_id=project_id,
            discipline_id=discipline_id,
            phase_id=phase_id,
            header_json="{}"
        )
        db.add(cell)
        db.commit()
        db.refresh(cell)
    return cell


def _cell_summary(cell: MatrixCell) -> dict:
    spec_names = set(e.spec_name for e in cell.entries if e.spec_name)
    return {
        "discipline_id": cell.discipline_id,
        "phase_id": cell.phase_id,
        "entry_count": len(cell.entries),
        "spec_count": len(spec_names),
    }


def _entry_to_dict(e: CellEntry) -> dict:
    return {
        "id": e.id,
        "cell_id": e.cell_id,
        "source_ids_id": e.source_ids_id,
        "entry_type": e.entry_type,
        "spec_name": e.spec_name,
        "applicability": json.loads(e.applicability_json),
        "requirement": json.loads(e.requirement_json),
        "status": e.status,
        "group_key": e.group_key,
        "group_type": e.group_type,
        "order_index": e.order_index,
    }


@router.get("/matrix")
def get_matrix_summary(project_id: int, db: Session = Depends(get_db)):
    cells = db.query(MatrixCell).filter_by(project_id=project_id).all()
    return [_cell_summary(c) for c in cells]


@router.get("/matrix/{did}/{pid}")
def get_cell(project_id: int, did: int, pid: int, db: Session = Depends(get_db)):
    cell = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=did, phase_id=pid
    ).first()
    if not cell:
        return {"discipline_id": did, "phase_id": pid, "header": {}, "entries": []}
    header = json.loads(cell.header_json)
    return {
        "id": cell.id,
        "discipline_id": did,
        "phase_id": pid,
        "header": header,
        "entries": [_entry_to_dict(e) for e in cell.entries],
    }


@router.put("/matrix/{did}/{pid}/header")
def update_header(project_id: int, did: int, pid: int, body: HeaderUpdate, db: Session = Depends(get_db)):
    cell = _get_or_create_cell(project_id, did, pid, db)
    cell.header_json = json.dumps(body.model_dump())
    db.commit()
    return {"ok": True}


def _build_entries_for_spec(spec: dict, source_ids_id: int, group_key: str, group_type: str, order_offset: int = 0) -> list:
    """Build CellEntry objects for all requirements in a spec."""
    applicability = spec.get("applicability", {})
    applicability_list = [applicability] if applicability else []
    entries = []
    for req_idx, req in enumerate(spec.get("requirements", [])):
        entries.append(CellEntry(
            source_ids_id=source_ids_id,
            entry_type="requirement",
            spec_name=spec["name"],
            applicability_json=json.dumps(applicability_list),
            requirement_json=json.dumps(req),
            status="required" if req.get("baseStatus") == "required" else "optional",
            group_key=group_key,
            group_type=group_type,
            order_index=order_offset + req_idx,
        ))
    return entries


@router.post("/matrix/{did}/{pid}/drop")
def drop_onto_cell(project_id: int, did: int, pid: int, body: DropPayload, db: Session = Depends(get_db)):
    source = db.query(IDSSource).filter(IDSSource.id == body.source_ids_id, IDSSource.project_id == project_id).first()
    if not source:
        raise HTTPException(404, "Source IDS not found")

    parsed = json.loads(source.parsed_json)
    all_specs = parsed.get("specifications", [])

    # Build the list of (spec, group_key, group_type) tuples to add
    specs_to_add: list[tuple] = []

    if body.drop_type in ("ids", "multi_specification"):
        # Determine which specs to include
        if body.drop_type == "ids":
            target_specs = all_specs
        else:
            names_set = set(body.spec_names)
            target_specs = [s for s in all_specs if s["name"] in names_set]
        if not target_specs:
            raise HTTPException(404, "No matching specifications found in source")
        for s in target_specs:
            specs_to_add.append((s, str(uuid.uuid4()), "specification"))

    elif body.drop_type == "specification":
        spec = next((s for s in all_specs if s["name"] == body.spec_name), None)
        if not spec:
            raise HTTPException(404, f"Specification '{body.spec_name}' not found in source")
        specs_to_add.append((spec, str(uuid.uuid4()), "specification"))

    elif body.drop_type == "requirement":
        spec = next((s for s in all_specs if s["name"] == body.spec_name), None)
        if not spec:
            raise HTTPException(404, f"Specification '{body.spec_name}' not found in source")
        reqs = spec.get("requirements", [])
        if body.requirement_index is None or body.requirement_index >= len(reqs):
            raise HTTPException(400, "Requirement index out of range")
        req = reqs[body.requirement_index]
        applicability = spec.get("applicability", {})
        applicability_list = [applicability] if applicability else []
        gkey = str(uuid.uuid4())

        # Determine target cells
        target_phase_ids = [pid]
        if body.apply_to_all_phases:
            target_phase_ids = [p.id for p in db.query(Phase).filter(Phase.project_id == project_id).all()]

        for target_pid in target_phase_ids:
            cell = _get_or_create_cell(project_id, did, target_pid, db)
            max_order = max((e.order_index for e in cell.entries), default=-1) + 1
            db.add(CellEntry(
                cell_id=cell.id,
                source_ids_id=body.source_ids_id,
                entry_type="requirement",
                spec_name=spec["name"],
                applicability_json=json.dumps(applicability_list),
                requirement_json=json.dumps(req),
                status="required" if req.get("baseStatus") == "required" else "optional",
                group_key=gkey if target_pid == pid else str(uuid.uuid4()),
                group_type="standalone",
                order_index=max_order,
            ))
        db.commit()
        return {"ok": True, "entries_added": 1, "phases_updated": len(target_phase_ids)}

    # For specs_to_add: add all entries to target cells
    total_entries = 0
    target_phase_ids = [pid]
    if body.apply_to_all_phases:
        target_phase_ids = [p.id for p in db.query(Phase).filter(Phase.project_id == project_id).all()]

    for target_pid in target_phase_ids:
        cell = _get_or_create_cell(project_id, did, target_pid, db)
        max_order = max((e.order_index for e in cell.entries), default=-1) + 1
        offset = max_order
        for spec, gkey, gtype in specs_to_add:
            use_gkey = gkey if target_pid == pid else str(uuid.uuid4())
            entries = _build_entries_for_spec(spec, body.source_ids_id, use_gkey, gtype, offset)
            for entry in entries:
                entry.cell_id = cell.id
                db.add(entry)
            offset += len(entries)
            if target_pid == pid:
                total_entries += len(entries)

    db.commit()
    return {"ok": True, "entries_added": total_entries, "phases_updated": len(target_phase_ids)}


@router.put("/matrix/entries/{eid}/status")
def update_entry_status(project_id: int, eid: int, body: StatusUpdate, db: Session = Depends(get_db)):
    entry = db.query(CellEntry).join(MatrixCell).filter(
        CellEntry.id == eid, MatrixCell.project_id == project_id
    ).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    entry.status = body.status
    db.commit()
    return {"ok": True}


@router.delete("/matrix/entries/{eid}")
def delete_entry(project_id: int, eid: int, db: Session = Depends(get_db)):
    entry = db.query(CellEntry).join(MatrixCell).filter(
        CellEntry.id == eid, MatrixCell.project_id == project_id
    ).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.delete("/matrix/entries/group/{gkey}")
def delete_group(project_id: int, gkey: str, db: Session = Depends(get_db)):
    entries = db.query(CellEntry).join(MatrixCell).filter(
        CellEntry.group_key == gkey, MatrixCell.project_id == project_id
    ).all()
    for e in entries:
        db.delete(e)
    db.commit()
    return {"ok": True, "deleted": len(entries)}


@router.delete("/matrix/{did}/{pid}")
def clear_cell(project_id: int, did: int, pid: int, db: Session = Depends(get_db)):
    cell = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=did, phase_id=pid
    ).first()
    if cell:
        for e in cell.entries:
            db.delete(e)
        db.commit()
    return {"ok": True}

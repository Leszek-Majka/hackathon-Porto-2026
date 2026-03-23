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
    purpose: str = ""
    milestone: str = ""


class DropPayload(BaseModel):
    source_ids_id: int
    drop_type: str  # specification | applicability | requirement | ids | multi_specification
    spec_name: str = ""
    spec_names: List[str] = []   # for multi_specification and ids drops
    applicability_index: Optional[int] = None
    requirement_index: Optional[int] = None
    apply_to_all_phases: bool = False
    value_override: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str  # required | optional | prohibited

class ValuesUpdate(BaseModel):
    values: List[str]


class SpecMetaUpdate(BaseModel):
    spec_name: str
    identifier: str = ""
    description: str = ""
    instructions: str = ""
    ifc_version: str = ""


def _get_value_list(req: dict) -> list | None:
    """Extract enum values from a requirement's value constraint. None = no value constraint."""
    v = req.get("value")
    if not v:
        return None
    if v.get("type") == "simpleValue":
        val = v.get("value")
        return [val] if val else None
    if v.get("type") == "enumeration":
        return list(v.get("values") or [])
    return None  # pattern / restriction — not mergeable


def _merge_req_values(existing: dict, incoming: dict) -> dict | None:
    """
    Merge two requirement dicts that share the same key.
    Returns the merged dict, or None if they are identical (skip the incoming).
    """
    ev = _get_value_list(existing)
    nv = _get_value_list(incoming)

    # Both have no value constraint → exact duplicate, skip
    if ev is None and nv is None:
        return None

    # Same values → duplicate, skip
    if ev == nv:
        return None

    # Merge value lists (deduplicated, order preserved)
    combined = list(dict.fromkeys((ev or []) + (nv or [])))
    result = dict(existing)
    if len(combined) == 0:
        result.pop("value", None)
    elif len(combined) == 1:
        result["value"] = {"type": "simpleValue", "value": combined[0]}
    else:
        result["value"] = {"type": "enumeration", "values": combined}
    return result


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
        "spec_meta": json.loads(e.spec_meta_json or "{}"),
    }


def _extract_spec_meta(spec: dict) -> dict:
    return {
        "identifier": spec.get("id", ""),
        "description": spec.get("description", ""),
        "instructions": spec.get("instructions", ""),
        "ifc_version": spec.get("ifcVersion", ""),
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
    spec_meta = json.dumps(_extract_spec_meta(spec))
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
            spec_meta_json=spec_meta,
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
        req = dict(reqs[body.requirement_index])  # copy so we don't mutate parsed source
        if body.value_override is not None:
            req["value"] = {"type": "simpleValue", "value": body.value_override}
        applicability = spec.get("applicability", {})
        applicability_list = [applicability] if applicability else []
        req_key = req.get("key", "")

        # Determine target cells
        target_phase_ids = [pid]
        if body.apply_to_all_phases:
            target_phase_ids = [p.id for p in db.query(Phase).filter(Phase.project_id == project_id).all()]

        merged_count = 0
        added_count = 0
        for target_pid in target_phase_ids:
            cell = _get_or_create_cell(project_id, did, target_pid, db)

            # Look for existing entry with same spec + requirement key
            existing = next(
                (e for e in cell.entries
                 if e.spec_name == spec["name"]
                 and json.loads(e.requirement_json).get("key") == req_key),
                None
            )

            if existing:
                existing_req = json.loads(existing.requirement_json)
                merged = _merge_req_values(existing_req, req)
                if merged is None:
                    merged_count += 1  # exact duplicate — skip
                    continue
                existing.requirement_json = json.dumps(merged)
                merged_count += 1
            else:
                max_order = max((e.order_index for e in cell.entries), default=-1) + 1
                db.add(CellEntry(
                    cell_id=cell.id,
                    source_ids_id=body.source_ids_id,
                    entry_type="requirement",
                    spec_name=spec["name"],
                    applicability_json=json.dumps(applicability_list),
                    requirement_json=json.dumps(req),
                    status="required" if req.get("baseStatus") == "required" else "optional",
                    group_key=str(uuid.uuid4()),
                    group_type="standalone",
                    order_index=max_order,
                    spec_meta_json=json.dumps(_extract_spec_meta(spec)),
                ))
                added_count += 1

        db.commit()
        return {"ok": True, "entries_added": added_count, "merged": merged_count}

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


@router.patch("/matrix/entries/{eid}/values")
def update_entry_values(project_id: int, eid: int, body: ValuesUpdate, db: Session = Depends(get_db)):
    entry = db.query(CellEntry).join(MatrixCell).filter(
        CellEntry.id == eid, MatrixCell.project_id == project_id
    ).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    req = json.loads(entry.requirement_json)
    if len(body.values) == 0:
        req.pop("value", None)
    elif len(body.values) == 1:
        req["value"] = {"type": "simpleValue", "value": body.values[0]}
    else:
        req["value"] = {"type": "enumeration", "values": body.values}
    entry.requirement_json = json.dumps(req)
    db.commit()
    return {"ok": True}


@router.patch("/matrix/{did}/{pid}/spec-meta")
def update_spec_meta(project_id: int, did: int, pid: int, body: SpecMetaUpdate, db: Session = Depends(get_db)):
    cell = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=did, phase_id=pid
    ).first()
    if not cell:
        raise HTTPException(404, "Cell not found")
    meta = json.dumps({
        "identifier": body.identifier,
        "description": body.description,
        "instructions": body.instructions,
        "ifc_version": body.ifc_version,
    })
    for entry in cell.entries:
        if entry.spec_name == body.spec_name:
            entry.spec_meta_json = meta
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

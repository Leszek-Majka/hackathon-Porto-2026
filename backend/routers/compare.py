from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import json
from database import get_db
from models import Discipline, Phase, MatrixCell, IDSSource

router = APIRouter(prefix="/api/projects/{project_id}", tags=["compare"])


def _req_signature(req: dict) -> str:
    t = req.get("type", "")
    if t == "attribute":
        return f"attribute::{(req.get('name') or {}).get('value', '')}"
    elif t == "property":
        ps = (req.get("propertySet") or {}).get("value", "")
        bn = (req.get("baseName") or {}).get("value", "")
        return f"property::{ps}::{bn}"
    elif t == "material":
        return "material"
    elif t == "classification":
        return f"classification::{(req.get('system') or {}).get('value', '')}"
    elif t == "partOf":
        rel = req.get("relation", "")
        en = ((req.get("entity") or {}).get("name") or {}).get("value", "")
        return f"partOf::{rel}::{en}"
    elif t == "entity":
        name = (req.get("name") or {}).get("value", "")
        pre = (req.get("predefinedType") or {}).get("value", "")
        return f"entity::{name}::{pre}"
    return t


def _req_label(req: dict) -> str:
    t = req.get("type", "")
    if t == "attribute":
        return (req.get("name") or {}).get("value", "Attribute")
    elif t == "property":
        ps = (req.get("propertySet") or {}).get("value", "")
        bn = (req.get("baseName") or {}).get("value", "")
        return f"{ps}.{bn}" if ps and bn else bn or ps or "Property"
    elif t == "material":
        return "Material"
    elif t == "classification":
        return (req.get("system") or {}).get("value", "Classification")
    elif t == "partOf":
        en = ((req.get("entity") or {}).get("name") or {}).get("value", "")
        return f"partOf {en}" if en else "Part Of"
    elif t == "entity":
        name = (req.get("name") or {}).get("value", "")
        pre = (req.get("predefinedType") or {}).get("value", "")
        return f"{name} ({pre})" if pre else name or "Entity"
    return t


def _get_enum_values(req: dict) -> list:
    v = req.get("value")
    if not v:
        return []
    if v.get("type") == "enumeration":
        return list(v.get("values") or [])
    if v.get("type") == "simpleValue" and v.get("value"):
        return [v["value"]]
    return []


def _extract_cell_reqs(cell: MatrixCell | None) -> dict:
    """Returns {signature: {label, type, spec_name, status, enum_values}}."""
    if not cell:
        return {}
    result = {}
    for entry in cell.entries:
        req = json.loads(entry.requirement_json)
        sig = _req_signature(req)
        enums = _get_enum_values(req)
        if sig not in result:
            result[sig] = {
                "signature": sig,
                "label": _req_label(req),
                "type": req.get("type", ""),
                "spec_name": entry.spec_name,
                "status": entry.status,
                "enum_values": enums,
            }
        else:
            merged = list(dict.fromkeys(result[sig]["enum_values"] + enums))
            result[sig]["enum_values"] = merged
    return result


def _extract_spec_metas(cell: MatrixCell | None) -> dict:
    """Returns {spec_name: spec_meta_dict} — first entry wins per spec."""
    if not cell:
        return {}
    result = {}
    for entry in cell.entries:
        if entry.spec_name and entry.spec_name not in result:
            result[entry.spec_name] = json.loads(entry.spec_meta_json or "{}")
    return result


def _extract_ids_reqs(source: IDSSource) -> dict:
    """Extract requirements from a raw IDS source, same shape as _extract_cell_reqs."""
    parsed = json.loads(source.parsed_json)
    result = {}
    for spec in parsed.get("specifications", []):
        spec_name = spec.get("name", "")
        for req in spec.get("requirements", []):
            sig = _req_signature(req)
            enums = _get_enum_values(req)
            status = "required" if req.get("baseStatus") == "required" else "optional"
            if sig not in result:
                result[sig] = {
                    "signature": sig,
                    "label": _req_label(req),
                    "type": req.get("type", ""),
                    "spec_name": spec_name,
                    "status": status,
                    "enum_values": enums,
                }
            else:
                merged = list(dict.fromkeys(result[sig]["enum_values"] + enums))
                result[sig]["enum_values"] = merged
    return result


def _ids_stats(source: IDSSource) -> dict:
    parsed = json.loads(source.parsed_json)
    specs = parsed.get("specifications", [])
    spec_names = {s.get("name", "") for s in specs}
    required = optional = enum_count = total = 0
    for spec in specs:
        for req in spec.get("requirements", []):
            total += 1
            if req.get("baseStatus") == "required":
                required += 1
            else:
                optional += 1
            enum_count += len(_get_enum_values(req))
    return {
        "spec_count": len(spec_names),
        "total": total,
        "required": required,
        "optional": optional,
        "prohibited": 0,
        "enum_count": enum_count,
    }


def _ids_spec_metas(source: IDSSource) -> dict:
    """Returns {spec_name: {identifier, description, instructions, ifc_version}}."""
    parsed = json.loads(source.parsed_json)
    return {
        s.get("name", ""): {
            "identifier":   s.get("id", ""),
            "description":  s.get("description", ""),
            "instructions": s.get("instructions", ""),
            "ifc_version":  s.get("ifcVersion", ""),
        }
        for s in parsed.get("specifications", [])
    }


def _cell_stats(cell: MatrixCell | None) -> dict:
    if not cell or not cell.entries:
        return {"spec_count": 0, "total": 0, "required": 0, "optional": 0, "prohibited": 0, "enum_count": 0}
    entries = cell.entries
    required   = sum(1 for e in entries if e.status == "required")
    optional   = sum(1 for e in entries if e.status == "optional")
    prohibited = sum(1 for e in entries if e.status == "prohibited")
    enum_count = sum(len(_get_enum_values(json.loads(e.requirement_json))) for e in entries)
    spec_names = set(e.spec_name for e in entries if e.spec_name)
    return {
        "spec_count": len(spec_names),
        "total": len(entries),
        "required": required,
        "optional": optional,
        "prohibited": prohibited,
        "enum_count": enum_count,
    }


@router.get("/compare-cells")
def compare_cells(
    project_id: int,
    # cell selectors (required only when source_* not provided)
    disc_a: Optional[int] = None, phase_a: Optional[int] = None,
    disc_b: Optional[int] = None, phase_b: Optional[int] = None,
    # IDS source selectors (override the cell selectors for that side)
    source_a: Optional[int] = None,
    source_b: Optional[int] = None,
    db: Session = Depends(get_db),
):
    # ── Resolve side A ────────────────────────────────────────────────────────
    if source_a is not None:
        src_a = db.query(IDSSource).filter_by(id=source_a, project_id=project_id).first()
        if not src_a:
            raise HTTPException(404, "IDS source A not found")
        reqs_a   = _extract_ids_reqs(src_a)
        stats_a  = _ids_stats(src_a)
        metas_a  = _ids_spec_metas(src_a)
        header_a = {"title": src_a.title, "author": src_a.author,
                    "date": src_a.date, "version": src_a.version}
        label_a  = src_a.title or src_a.filename
        info_a   = {"source_id": src_a.id, "label": label_a,
                    "header": header_a, "stats": stats_a, "kind": "ids"}
    else:
        if disc_a is None or phase_a is None:
            raise HTTPException(400, "Provide disc_a+phase_a or source_a")
        d_a = db.query(Discipline).filter_by(id=disc_a, project_id=project_id).first()
        p_a = db.query(Phase).filter_by(id=phase_a,     project_id=project_id).first()
        if not d_a or not p_a:
            raise HTTPException(404, "Discipline or phase A not found")
        cell_a  = db.query(MatrixCell).filter_by(project_id=project_id, discipline_id=disc_a, phase_id=phase_a).first()
        reqs_a  = _extract_cell_reqs(cell_a)
        stats_a = _cell_stats(cell_a)
        metas_a = _extract_spec_metas(cell_a)
        header_a = json.loads(cell_a.header_json) if cell_a else {}
        label_a  = f"{d_a.name} × {p_a.name}"
        info_a   = {"discipline_id": disc_a, "phase_id": phase_a,
                    "label": label_a, "discipline_name": d_a.name, "phase_name": p_a.name,
                    "header": header_a, "stats": stats_a, "kind": "cell"}

    # ── Resolve side B ────────────────────────────────────────────────────────
    if source_b is not None:
        src_b = db.query(IDSSource).filter_by(id=source_b, project_id=project_id).first()
        if not src_b:
            raise HTTPException(404, "IDS source B not found")
        reqs_b   = _extract_ids_reqs(src_b)
        stats_b  = _ids_stats(src_b)
        metas_b  = _ids_spec_metas(src_b)
        header_b = {"title": src_b.title, "author": src_b.author,
                    "date": src_b.date, "version": src_b.version}
        label_b  = src_b.title or src_b.filename
        info_b   = {"source_id": src_b.id, "label": label_b,
                    "header": header_b, "stats": stats_b, "kind": "ids"}
    else:
        if disc_b is None or phase_b is None:
            raise HTTPException(400, "Provide disc_b+phase_b or source_b")
        d_b = db.query(Discipline).filter_by(id=disc_b, project_id=project_id).first()
        p_b = db.query(Phase).filter_by(id=phase_b,     project_id=project_id).first()
        if not d_b or not p_b:
            raise HTTPException(404, "Discipline or phase B not found")
        cell_b  = db.query(MatrixCell).filter_by(project_id=project_id, discipline_id=disc_b, phase_id=phase_b).first()
        reqs_b  = _extract_cell_reqs(cell_b)
        stats_b = _cell_stats(cell_b)
        metas_b = _extract_spec_metas(cell_b)
        header_b = json.loads(cell_b.header_json) if cell_b else {}
        label_b  = f"{d_b.name} × {p_b.name}"
        info_b   = {"discipline_id": disc_b, "phase_id": phase_b,
                    "label": label_b, "discipline_name": d_b.name, "phase_name": p_b.name,
                    "header": header_b, "stats": stats_b, "kind": "cell"}

    sigs_a      = set(reqs_a.keys())
    sigs_b      = set(reqs_b.keys())
    common_sigs = sigs_a & sigs_b
    only_a_sigs = sigs_a - sigs_b
    only_b_sigs = sigs_b - sigs_a

    # Classify common requirements
    changed_list  = []
    identical_list = []
    status_changes = []
    value_changes  = []

    for sig in common_sigs:
        ra, rb = reqs_a[sig], reqs_b[sig]
        s_diff = ra["status"] != rb["status"]
        v_diff = set(ra["enum_values"]) != set(rb["enum_values"])
        entry = {
            "signature": sig,
            "label":     ra["label"],
            "type":      ra["type"],
            "spec_name": ra["spec_name"],
            "status_a":  ra["status"],
            "status_b":  rb["status"],
            "enum_a":    ra["enum_values"],
            "enum_b":    rb["enum_values"],
            "status_changed": s_diff,
            "values_changed": v_diff,
        }
        if s_diff or v_diff:
            changed_list.append(entry)
        else:
            identical_list.append(entry)
        if s_diff:
            status_changes.append(entry)
        if v_diff:
            value_changes.append(entry)

    # Per-spec breakdown
    all_specs = sorted({r["spec_name"] for r in list(reqs_a.values()) + list(reqs_b.values())})
    by_spec = []
    for spec in all_specs:
        by_spec.append({
            "spec_name": spec,
            "only_a":    sum(1 for s in only_a_sigs  if reqs_a[s]["spec_name"] == spec),
            "only_b":    sum(1 for s in only_b_sigs  if reqs_b[s]["spec_name"] == spec),
            "changed":   sum(1 for e in changed_list  if e["spec_name"] == spec),
            "identical": sum(1 for e in identical_list if e["spec_name"] == spec),
        })

    # Spec metadata changes (for specs present in both cells)
    _META_FIELDS = [
        ("identifier",   "Identifier"),
        ("description",  "Description"),
        ("instructions", "Instructions"),
        ("ifc_version",  "IFC Version"),
    ]
    spec_meta_changes = []
    for spec_name in sorted(set(metas_a.keys()) & set(metas_b.keys())):
        ma, mb = metas_a[spec_name], metas_b[spec_name]
        changed_fields = [
            {"field": label, "value_a": ma.get(key, ""), "value_b": mb.get(key, "")}
            for key, label in _META_FIELDS
            if ma.get(key, "") != mb.get(key, "")
        ]
        if changed_fields:
            spec_meta_changes.append({"spec_name": spec_name, "fields": changed_fields})

    srt = lambda lst: sorted(lst, key=lambda r: r["label"])

    return {
        "cell_a": info_a,
        "cell_b": info_b,
        "overview": {
            "total_a":        len(sigs_a),
            "total_b":        len(sigs_b),
            "common":         len(common_sigs),
            "only_a":         len(only_a_sigs),
            "only_b":         len(only_b_sigs),
            "changed":        len(changed_list),
            "identical":      len(identical_list),
            "status_changes": len(status_changes),
            "value_changes":  len(value_changes),
        },
        "only_a":        srt([reqs_a[s] for s in only_a_sigs]),
        "only_b":        srt([reqs_b[s] for s in only_b_sigs]),
        "changed":       srt(changed_list),
        "identical":     srt(identical_list),
        "status_changes":    srt(status_changes),
        "value_changes":     srt(value_changes),
        "by_spec":           by_spec,
        "spec_meta_changes": spec_meta_changes,
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from database import get_db
from models import Discipline, Phase, MatrixCell

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
    disc_a: int, phase_a: int,
    disc_b: int, phase_b: int,
    db: Session = Depends(get_db),
):
    d_a = db.query(Discipline).filter_by(id=disc_a,  project_id=project_id).first()
    p_a = db.query(Phase).filter_by(id=phase_a, project_id=project_id).first()
    d_b = db.query(Discipline).filter_by(id=disc_b,  project_id=project_id).first()
    p_b = db.query(Phase).filter_by(id=phase_b, project_id=project_id).first()
    if not all([d_a, p_a, d_b, p_b]):
        raise HTTPException(404, "Discipline or phase not found")

    cell_a = db.query(MatrixCell).filter_by(project_id=project_id, discipline_id=disc_a, phase_id=phase_a).first()
    cell_b = db.query(MatrixCell).filter_by(project_id=project_id, discipline_id=disc_b, phase_id=phase_b).first()

    reqs_a   = _extract_cell_reqs(cell_a)
    reqs_b   = _extract_cell_reqs(cell_b)
    stats_a  = _cell_stats(cell_a)
    stats_b  = _cell_stats(cell_b)
    header_a = json.loads(cell_a.header_json) if cell_a else {}
    header_b = json.loads(cell_b.header_json) if cell_b else {}
    metas_a  = _extract_spec_metas(cell_a)
    metas_b  = _extract_spec_metas(cell_b)

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
        "cell_a": {
            "discipline_id": disc_a, "phase_id": phase_a,
            "label": f"{d_a.name} × {p_a.name}",
            "discipline_name": d_a.name, "phase_name": p_a.name,
            "header": header_a, "stats": stats_a,
        },
        "cell_b": {
            "discipline_id": disc_b, "phase_id": phase_b,
            "label": f"{d_b.name} × {p_b.name}",
            "discipline_name": d_b.name, "phase_name": p_b.name,
            "header": header_b, "stats": stats_b,
        },
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

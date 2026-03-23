from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from database import get_db
from models import Discipline, Phase, MatrixCell

router = APIRouter(prefix="/api/projects/{project_id}", tags=["compare"])


def _req_signature(req: dict) -> str:
    t = req.get("type", "")
    if t == "attribute":
        name = (req.get("name") or {}).get("value", "")
        return f"attribute::{name}"
    elif t == "property":
        ps = (req.get("propertySet") or {}).get("value", "")
        bn = (req.get("baseName") or {}).get("value", "")
        return f"property::{ps}::{bn}"
    elif t == "material":
        return "material"
    elif t == "classification":
        sys_ = (req.get("system") or {}).get("value", "")
        return f"classification::{sys_}"
    elif t == "partOf":
        relation = req.get("relation", "")
        entity_name = ((req.get("entity") or {}).get("name") or {}).get("value", "")
        return f"partOf::{relation}::{entity_name}"
    elif t == "entity":
        name = (req.get("name") or {}).get("value", "")
        predef = (req.get("predefinedType") or {}).get("value", "")
        return f"entity::{name}::{predef}"
    return t


def _req_label(req: dict) -> str:
    t = req.get("type", "")
    if t == "attribute":
        return (req.get("name") or {}).get("value", "Attribute")
    elif t == "property":
        ps = (req.get("propertySet") or {}).get("value", "")
        bn = (req.get("baseName") or {}).get("value", "")
        if ps and bn:
            return f"{ps}.{bn}"
        return bn or ps or "Property"
    elif t == "material":
        return "Material"
    elif t == "classification":
        return (req.get("system") or {}).get("value", "Classification")
    elif t == "partOf":
        entity_name = ((req.get("entity") or {}).get("name") or {}).get("value", "")
        return f"partOf {entity_name}" if entity_name else "Part Of"
    elif t == "entity":
        name = (req.get("name") or {}).get("value", "")
        predef = (req.get("predefinedType") or {}).get("value", "")
        return f"{name} ({predef})" if predef else name or "Entity"
    return t


def _extract_cell_reqs(cell: MatrixCell | None) -> dict:
    """Returns {signature: {label, type, spec_name}} for all entries in a cell."""
    if not cell:
        return {}
    result = {}
    for entry in cell.entries:
        req = json.loads(entry.requirement_json)
        sig = _req_signature(req)
        if sig not in result:
            result[sig] = {
                "signature": sig,
                "label": _req_label(req),
                "type": req.get("type", ""),
                "spec_name": entry.spec_name,
            }
    return result


@router.get("/compare-cells")
def compare_cells(
    project_id: int,
    disc_a: int,
    phase_a: int,
    disc_b: int,
    phase_b: int,
    db: Session = Depends(get_db),
):
    d_a = db.query(Discipline).filter(Discipline.id == disc_a, Discipline.project_id == project_id).first()
    p_a = db.query(Phase).filter(Phase.id == phase_a, Phase.project_id == project_id).first()
    d_b = db.query(Discipline).filter(Discipline.id == disc_b, Discipline.project_id == project_id).first()
    p_b = db.query(Phase).filter(Phase.id == phase_b, Phase.project_id == project_id).first()

    if not all([d_a, p_a, d_b, p_b]):
        raise HTTPException(404, "Discipline or phase not found")

    cell_a = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=disc_a, phase_id=phase_a
    ).first()
    cell_b = db.query(MatrixCell).filter_by(
        project_id=project_id, discipline_id=disc_b, phase_id=phase_b
    ).first()

    reqs_a = _extract_cell_reqs(cell_a)
    reqs_b = _extract_cell_reqs(cell_b)

    sigs_a = set(reqs_a.keys())
    sigs_b = set(reqs_b.keys())
    common_sigs = sigs_a & sigs_b
    only_a_sigs  = sigs_a - sigs_b
    only_b_sigs  = sigs_b - sigs_a

    return {
        "cell_a": {
            "discipline_id": disc_a, "phase_id": phase_a,
            "label": f"{d_a.name} × {p_a.name}",
            "discipline_name": d_a.name, "phase_name": p_a.name,
        },
        "cell_b": {
            "discipline_id": disc_b, "phase_id": phase_b,
            "label": f"{d_b.name} × {p_b.name}",
            "discipline_name": d_b.name, "phase_name": p_b.name,
        },
        "stats": {
            "total_a": len(sigs_a),
            "total_b": len(sigs_b),
            "common":  len(common_sigs),
            "only_a":  len(only_a_sigs),
            "only_b":  len(only_b_sigs),
        },
        "common": sorted([reqs_a[s] for s in common_sigs], key=lambda r: r["label"]),
        "only_a": sorted([reqs_a[s] for s in only_a_sigs], key=lambda r: r["label"]),
        "only_b": sorted([reqs_b[s] for s in only_b_sigs], key=lambda r: r["label"]),
    }

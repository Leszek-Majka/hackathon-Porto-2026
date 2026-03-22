from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from database import get_db
from models import IDSSource

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
    return t


def _extract_reqs(source: IDSSource) -> dict:
    """Returns {signature: {label, type, spec_name, req}} for all requirements."""
    parsed = json.loads(source.parsed_json)
    result = {}
    for spec in parsed.get("specifications", []):
        for req in spec.get("requirements", []):
            sig = _req_signature(req)
            if sig not in result:
                result[sig] = {
                    "signature": sig,
                    "label": _req_label(req),
                    "type": req.get("type", ""),
                    "spec_name": spec.get("name", ""),
                }
    return result


@router.get("/compare")
def compare_sources(
    project_id: int,
    source_a: int,
    source_b: int,
    db: Session = Depends(get_db),
):
    src_a = db.query(IDSSource).filter(IDSSource.id == source_a, IDSSource.project_id == project_id).first()
    src_b = db.query(IDSSource).filter(IDSSource.id == source_b, IDSSource.project_id == project_id).first()
    if not src_a or not src_b:
        raise HTTPException(404, "One or both sources not found")

    reqs_a = _extract_reqs(src_a)
    reqs_b = _extract_reqs(src_b)

    sigs_a = set(reqs_a.keys())
    sigs_b = set(reqs_b.keys())

    common_sigs = sigs_a & sigs_b
    only_a_sigs = sigs_a - sigs_b
    only_b_sigs = sigs_b - sigs_a

    return {
        "source_a": {"id": src_a.id, "filename": src_a.filename, "title": src_a.title},
        "source_b": {"id": src_b.id, "filename": src_b.filename, "title": src_b.title},
        "stats": {
            "total_a": len(sigs_a),
            "total_b": len(sigs_b),
            "common": len(common_sigs),
            "only_a": len(only_a_sigs),
            "only_b": len(only_b_sigs),
        },
        "common":  sorted([reqs_a[s] for s in common_sigs],  key=lambda r: r["label"]),
        "only_a":  sorted([reqs_a[s] for s in only_a_sigs],  key=lambda r: r["label"]),
        "only_b":  sorted([reqs_b[s] for s in only_b_sigs],  key=lambda r: r["label"]),
    }

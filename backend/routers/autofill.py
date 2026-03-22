from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from database import get_db
from models import Project, IdsFile, Phase, PhaseMatrix
from ids_split_node import IDSSplitNode
import json, tempfile, os

router = APIRouter(prefix="/api/projects/{project_id}", tags=["autofill"])
node = IDSSplitNode()


class AutoFillRequest(BaseModel):
    phase_id: int
    filters: List[str]
    # status to apply to matched requirements: "required" or "optional"
    apply_status: str = "required"
    # if True, only preview — do not write to DB
    dry_run: bool = False


class AutoFillResponse(BaseModel):
    dry_run: bool
    matched_specs: int
    matched_requirements: int
    updated_cells: int
    preview: list
    error: str | None = None


@router.post("/matrix/autofill", response_model=AutoFillResponse)
def autofill_matrix(project_id: int, body: AutoFillRequest, db: Session = Depends(get_db)):
    # Load IDS file for this project
    ids_file = db.query(IdsFile).filter(IdsFile.project_id == project_id).first()
    if not ids_file:
        raise HTTPException(404, "No IDS file uploaded for this project")

    phase = db.query(Phase).filter(Phase.id == body.phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")

    # Write raw XML to a temp file (IDSSplitNode.split() needs a file path)
    with tempfile.NamedTemporaryFile(suffix=".ids", delete=False, mode="w", encoding="utf-8") as tmp:
        tmp.write(ids_file.raw_xml)
        tmp_path = tmp.name

    try:
        preview_result = node.preview(tmp_path, body.filters)
    finally:
        os.unlink(tmp_path)

    if not preview_result["matched"]:
        return AutoFillResponse(
            dry_run=body.dry_run,
            matched_specs=0,
            matched_requirements=0,
            updated_cells=0,
            preview=[],
            error=preview_result["error"]
        )

    # Parse the full IDS structure to build requirement key mapping
    # requirement key format matches what ids_parser.py generates:
    # "attr_{i}_{name}", "prop_{i}_{name}", "mat_{i}", "cls_{i}", "part_{i}"
    parsed = json.loads(ids_file.parsed_json)

    # Build a lookup: spec_name → list of all requirement keys
    spec_req_map = {}
    for spec in parsed.get("specs", []):
        spec_req_map[spec["name"]] = {
            req["key"]: req for req in spec.get("requirements", [])
        }

    matched_specs = 0
    matched_requirements = 0
    updated_cells = 0

    for preview_spec in preview_result["specs"]:
        spec_name = preview_spec["spec_name"]
        if spec_name not in spec_req_map:
            continue

        matched_specs += 1
        all_req_keys = list(spec_req_map[spec_name].keys())

        # Find the spec_id from parsed data
        spec_id = None
        for spec in parsed.get("specs", []):
            if spec["name"] == spec_name:
                spec_id = spec["id"]
                break

        if not spec_id:
            continue

        # Determine which requirement keys survived the filter
        surviving_req_names = set()
        for sr in preview_spec["surviving_requirements"]:
            # Match by type + name/baseName/propertySet
            for key, req in spec_req_map[spec_name].items():
                if _req_matches_describe(req, sr):
                    surviving_req_names.add(key)

        matched_requirements += len(surviving_req_names)

        if not body.dry_run:
            for req_key in surviving_req_names:
                # Upsert into phase_matrix
                existing = db.query(PhaseMatrix).filter_by(
                    project_id=project_id,
                    spec_id=spec_id,
                    requirement_key=req_key,
                    phase_id=body.phase_id
                ).first()
                if existing:
                    existing.status = body.apply_status
                else:
                    db.add(PhaseMatrix(
                        project_id=project_id,
                        spec_id=spec_id,
                        requirement_key=req_key,
                        phase_id=body.phase_id,
                        status=body.apply_status
                    ))
                updated_cells += 1
            db.commit()

    return AutoFillResponse(
        dry_run=body.dry_run,
        matched_specs=matched_specs,
        matched_requirements=matched_requirements,
        updated_cells=updated_cells,
        preview=preview_result["specs"],
    )


def _req_matches_describe(req: dict, described: dict) -> bool:
    """Match a stored requirement dict against a _describe_facet output."""
    req_type_map = {
        "attribute": "Attribute",
        "property": "Property",
        "material": "Material",
        "classification": "Classification",
        "partOf": "PartOf",
    }
    if req_type_map.get(req.get("type")) != described.get("type"):
        return False
    if req.get("type") == "property":
        return req.get("name") == described.get("baseName")
    if req.get("type") == "attribute":
        return req.get("name") == described.get("name")
    return True  # material, classification, partOf — match by type

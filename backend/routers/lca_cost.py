"""LCA Cost analysis router — IFC extraction, 40-year projections, param updates."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Project, IFCFile, LcaCostResult
from lca_cost_extractor import extract_lca_cost_data, enrich_assemblies
from lca_cost_projector import compute_40yr_projections

router = APIRouter(prefix="/api/projects", tags=["lca-cost"])

DEFAULT_PARAMS = {
    "study_period": 40,
    "discount_rate": 0.03,
    "energy_escalation": 0.02,
    "carbon_price": 300,
    "grid_factor": 0.074,
}


class LcaCostParams(BaseModel):
    study_period: Optional[int] = 40
    discount_rate: Optional[float] = 0.03
    energy_escalation: Optional[float] = 0.02
    carbon_price: Optional[float] = 300
    grid_factor: Optional[float] = 0.074


# ── Sample data for projects without an IFC file ──────────────────────

SAMPLE_ASSEMBLIES = [
    {"global_id": "SAMPLE-001", "name": "External Wall", "type": "IfcWall", "volume_m3": 180.0, "gwp_kgco2e_m3": 250, "cost_capital": 27000, "cost_maint_annual": 135, "replacement_year": None, "replacement_pct": 0, "energy_impact_kwh": 2700, "material": "Concrete"},
    {"global_id": "SAMPLE-002", "name": "Ground Floor Slab", "type": "IfcSlab", "volume_m3": 246.0, "gwp_kgco2e_m3": 250, "cost_capital": 36900, "cost_maint_annual": 184.5, "replacement_year": None, "replacement_pct": 0, "energy_impact_kwh": 3690, "material": "Reinforced Concrete"},
    {"global_id": "SAMPLE-003", "name": "Roof Structure", "type": "IfcRoof", "volume_m3": 48.0, "gwp_kgco2e_m3": -500, "cost_capital": 19200, "cost_maint_annual": 384, "replacement_year": 25, "replacement_pct": 0.15, "energy_impact_kwh": 720, "material": "Timber (CLT)"},
    {"global_id": "SAMPLE-004", "name": "Glazing Facade", "type": "IfcCurtainWall", "volume_m3": 14.4, "gwp_kgco2e_m3": 1800, "cost_capital": 17280, "cost_maint_annual": 259.2, "replacement_year": 25, "replacement_pct": 0.2, "energy_impact_kwh": 216, "material": "Glass / Al frame"},
    {"global_id": "SAMPLE-005", "name": "Steel Beams", "type": "IfcBeam", "volume_m3": 3.06, "gwp_kgco2e_m3": 1200, "cost_capital": 2448, "cost_maint_annual": 24.48, "replacement_year": 30, "replacement_pct": 0.1, "energy_impact_kwh": 45.9, "material": "Structural Steel"},
    {"global_id": "SAMPLE-006", "name": "Steel Columns", "type": "IfcColumn", "volume_m3": 2.3, "gwp_kgco2e_m3": 1200, "cost_capital": 1840, "cost_maint_annual": 18.4, "replacement_year": 30, "replacement_pct": 0.1, "energy_impact_kwh": 34.5, "material": "Structural Steel"},
    {"global_id": "SAMPLE-007", "name": "Foundation Pads", "type": "IfcFooting", "volume_m3": 320.0, "gwp_kgco2e_m3": 250, "cost_capital": 48000, "cost_maint_annual": 240, "replacement_year": None, "replacement_pct": 0, "energy_impact_kwh": 4800, "material": "RC Concrete"},
    {"global_id": "SAMPLE-008", "name": "Internal Partitions", "type": "IfcWall", "volume_m3": 46.5, "gwp_kgco2e_m3": 200, "cost_capital": 5580, "cost_maint_annual": 27.9, "replacement_year": None, "replacement_pct": 0, "energy_impact_kwh": 697.5, "material": "Brick / Mortar"},
    {"global_id": "SAMPLE-009", "name": "Pipework (Hot Water)", "type": "IfcPipeSegment", "volume_m3": 1.6, "gwp_kgco2e_m3": 3500, "cost_capital": 2400, "cost_maint_annual": 19.2, "replacement_year": 40, "replacement_pct": 0.05, "energy_impact_kwh": 24, "material": "Copper"},
    {"global_id": "SAMPLE-010", "name": "HVAC Ductwork", "type": "IfcDuctSegment", "volume_m3": 4.25, "gwp_kgco2e_m3": 1200, "cost_capital": 3400, "cost_maint_annual": 34, "replacement_year": 30, "replacement_pct": 0.1, "energy_impact_kwh": 63.75, "material": "Galv. Steel"},
]


@router.post("/{project_id}/lca-cost/compute")
def compute_lca_cost(project_id: int, params: LcaCostParams = LcaCostParams(), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    ifc_file = db.query(IFCFile).filter(IFCFile.project_id == project_id).first()

    assemblies = []
    ifc_file_id = None

    if ifc_file:
        ifc_file_id = ifc_file.id
        try:
            raw = extract_lca_cost_data(ifc_file.file_path)
            assemblies = enrich_assemblies(raw)
        except Exception:
            assemblies = []

    # Fall back to sample data if IFC extraction yielded nothing
    if not assemblies:
        assemblies = SAMPLE_ASSEMBLIES

    p = {
        "study_period": params.study_period or 40,
        "discount_rate": params.discount_rate if params.discount_rate is not None else 0.03,
        "energy_escalation": params.energy_escalation if params.energy_escalation is not None else 0.02,
        "carbon_price": params.carbon_price if params.carbon_price is not None else 300,
        "grid_factor": params.grid_factor if params.grid_factor is not None else 0.074,
    }

    projections = compute_40yr_projections(assemblies, p)

    result = LcaCostResult(
        project_id=project_id,
        ifc_file_id=ifc_file_id,
        params_json=json.dumps(p),
        assemblies_json=json.dumps(assemblies),
        projections_json=json.dumps(projections),
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return {
        "id": result.id,
        "assemblies": assemblies,
        "projections": projections,
        "params": p,
        "computed_at": result.computed_at.isoformat() if result.computed_at else None,
    }


@router.get("/{project_id}/lca-cost")
def get_lca_cost(project_id: int, db: Session = Depends(get_db)):
    result = (
        db.query(LcaCostResult)
        .filter(LcaCostResult.project_id == project_id)
        .order_by(LcaCostResult.computed_at.desc())
        .first()
    )
    if not result:
        return {"assemblies": [], "projections": [], "params": DEFAULT_PARAMS, "computed_at": None}

    return {
        "id": result.id,
        "assemblies": json.loads(result.assemblies_json),
        "projections": json.loads(result.projections_json),
        "params": json.loads(result.params_json),
        "computed_at": result.computed_at.isoformat() if result.computed_at else None,
    }


@router.put("/{project_id}/lca-cost/params")
def update_lca_cost_params(project_id: int, params: LcaCostParams, db: Session = Depends(get_db)):
    result = (
        db.query(LcaCostResult)
        .filter(LcaCostResult.project_id == project_id)
        .order_by(LcaCostResult.computed_at.desc())
        .first()
    )
    if not result:
        raise HTTPException(404, "No LCA cost data — run compute first")

    assemblies = json.loads(result.assemblies_json)
    p = {
        "study_period": params.study_period or 40,
        "discount_rate": params.discount_rate if params.discount_rate is not None else 0.03,
        "energy_escalation": params.energy_escalation if params.energy_escalation is not None else 0.02,
        "carbon_price": params.carbon_price if params.carbon_price is not None else 300,
        "grid_factor": params.grid_factor if params.grid_factor is not None else 0.074,
    }

    projections = compute_40yr_projections(assemblies, p)

    result.params_json = json.dumps(p)
    result.projections_json = json.dumps(projections)
    db.commit()
    db.refresh(result)

    return {
        "id": result.id,
        "assemblies": assemblies,
        "projections": projections,
        "params": p,
        "computed_at": result.computed_at.isoformat() if result.computed_at else None,
    }

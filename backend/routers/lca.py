import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import Project, Phase, Discipline, LCAEntry
from schemas import LCAEntryCreate, LCAEntryResponse, LCASummary

router = APIRouter(tags=["lca"])

# --- Validation logic ---

UNIT_RULES = {
    "IfcPipeSegment": {"m", "m2"},
    "IfcDuctSegment": {"m", "m2"},
    "IfcWall": {"m2", "m3"},
    "IfcSlab": {"m2", "m3"},
    "IfcRoof": {"m2", "m3"},
    "IfcBeam": {"kg", "m"},
    "IfcColumn": {"kg", "m"},
    "IfcMember": {"kg", "m"},
    "IfcFooting": {"m3"},
}


def validate_lca_entry(entry: LCAEntry) -> str:
    """Validate an LCA entry and return flag: ok, warn, or error."""
    if not entry.bsdd_uri:
        return "error"
    if not entry.gwp_factor or entry.gwp_factor == 0:
        return "error"
    allowed = UNIT_RULES.get(entry.ifc_entity)
    if allowed and entry.quantity_unit not in allowed:
        return "error"
    if not entry.material:
        return "warn"
    return "ok"


def compute_stage_check(entry: LCAEntry, loin: int = 2) -> dict:
    """Compute which EN 15978 stages are valid for this entry."""
    stages = {}
    stages["A1"] = bool(entry.material)
    stages["A2"] = True  # always projected
    stages["A3"] = bool(entry.gwp_factor and entry.gwp_factor > 0)
    stages["A4"] = True  # projected
    stages["A5"] = True  # projected
    stages["B1-B7"] = loin >= 4
    stages["C1-C4"] = loin >= 4
    stages["D"] = loin >= 4
    return stages


def compute_gwp(entry_data: dict, loin: int = 2) -> dict:
    """Compute GWP values from mass_kg and gwp_factor."""
    mass_kg = entry_data.get("mass_kg", 0) or 0
    gwp_factor = entry_data.get("gwp_factor", 0) or 0
    gwp_a1a3 = mass_kg * gwp_factor
    gwp_a4a5 = gwp_a1a3 * 0.08
    return {
        "gwp_a1a3": round(gwp_a1a3, 2),
        "gwp_a4a5": round(gwp_a4a5, 2),
        "gwp_b1b7": None if loin < 4 else 0.0,
        "gwp_c1c4": None if loin < 4 else 0.0,
        "gwp_d": None if loin < 4 else 0.0,
        "en15978_scope": "A1,A2,A3,A4,A5" if loin < 4 else "A1,A2,A3,A4,A5,B1,B2,B3,B4,B5,B6,B7,C1,C2,C3,C4,D",
    }


# --- RIBA Phase Seeding ---

RIBA_PHASES = [
    {"order_index": 0, "name": "Strategic Definition",    "code": "R0", "color": "#4e6a8a", "loin": 0, "gate": None},
    {"order_index": 1, "name": "Preparation & Brief",     "code": "R1", "color": "#3b7dd8", "loin": 1, "gate": "EIR"},
    {"order_index": 2, "name": "Concept Design",          "code": "R2", "color": "#00c8a0", "loin": 2, "gate": "SD"},
    {"order_index": 3, "name": "Spatial Coordination",    "code": "R3", "color": "#3b9eff", "loin": 3, "gate": "DD"},
    {"order_index": 4, "name": "Technical Design",        "code": "R4", "color": "#f4a031", "loin": 4, "gate": "TD"},
    {"order_index": 5, "name": "Manufacturing & Constr.", "code": "R5", "color": "#e05252", "loin": 5, "gate": "Constr"},
    {"order_index": 6, "name": "Handover",                "code": "R6", "color": "#b07ee8", "loin": 6, "gate": "AIM"},
    {"order_index": 7, "name": "Use",                     "code": "R7", "color": "#7a9ab8", "loin": 7, "gate": "FM"},
]


@router.post("/api/projects/{project_id}/phases/seed-riba")
def seed_riba_phases(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = db.query(Phase).filter(Phase.project_id == project_id).count()
    if existing > 0:
        raise HTTPException(status_code=400, detail="Phases already exist for this project")

    created = []
    for p_data in RIBA_PHASES:
        p = Phase(project_id=project_id, **p_data)
        db.add(p)
        created.append(p)
    db.commit()
    for p in created:
        db.refresh(p)
    return [
        {
            "id": p.id, "project_id": p.project_id, "name": p.name,
            "color": p.color, "order_index": p.order_index,
            "code": p.code, "loin": p.loin, "gate": p.gate,
            "created_at": p.created_at.isoformat(),
        }
        for p in created
    ]


# --- SAMPLE DATA ---

SAMPLE_LCA = {
    "ARCH": [
        {"element_name": "External wall",      "ifc_entity": "IfcWall",          "quantity_value": 450,  "quantity_unit": "m2", "material": "Concrete",         "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossArea",           "gwp_factor": 0.103, "mass_kg": 186300},
        {"element_name": "Ground floor slab",   "ifc_entity": "IfcSlab",          "quantity_value": 820,  "quantity_unit": "m2", "material": "Reinforced conc.", "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NetFloorArea",        "gwp_factor": 0.137, "mass_kg": 393600},
        {"element_name": "Roof structure",      "ifc_entity": "IfcRoof",          "quantity_value": 600,  "quantity_unit": "m2", "material": "Timber (CLT)",     "bsdd_uri": "https://identifier.buildingsmart.org/uri/TUe/DOR/0.0.2/prop/BiogenicCarbonContent",     "gwp_factor": 0.390, "mass_kg": 48000},
        {"element_name": "Glazing facade",      "ifc_entity": "IfcCurtainWall",   "quantity_value": 180,  "quantity_unit": "m2", "material": "Glass / Al frame", "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/IsExternal",         "gwp_factor": 8.240, "mass_kg": 7200},
        {"element_name": "Internal partition",  "ifc_entity": "IfcWall",          "quantity_value": 310,  "quantity_unit": "m2", "material": "Brick / mortar",   "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossArea",           "gwp_factor": 0.241, "mass_kg": 62000},
    ],
    "STRUCT": [
        {"element_name": "Foundation pads",     "ifc_entity": "IfcFooting",       "quantity_value": 320,  "quantity_unit": "m3", "material": "RC concrete",      "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GroundReactionForce", "gwp_factor": 0.137, "mass_kg": 768000},
        {"element_name": "Primary beams",       "ifc_entity": "IfcBeam",          "quantity_value": 2400, "quantity_unit": "kg", "material": "Structural steel", "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/LoadBearing",        "gwp_factor": 1.460, "mass_kg": 2400},
        {"element_name": "Columns",             "ifc_entity": "IfcColumn",        "quantity_value": 1800, "quantity_unit": "kg", "material": "Structural steel", "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/LoadBearing",        "gwp_factor": 1.460, "mass_kg": 1800},
        {"element_name": "Retaining wall",      "ifc_entity": "IfcWall",          "quantity_value": 85,   "quantity_unit": "m3", "material": "Concrete",         "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossVolume",         "gwp_factor": 0.103, "mass_kg": 204000},
    ],
    "MEP": [
        {"element_name": "Hot water pipework",  "ifc_entity": "IfcPipeSegment",   "quantity_value": 320,  "quantity_unit": "m",  "material": "Copper",           "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NominalLength",       "gwp_factor": 3.500, "mass_kg": 3200},
        {"element_name": "Ductwork supply",     "ifc_entity": "IfcDuctSegment",   "quantity_value": 850,  "quantity_unit": "m2", "material": "Galv. steel",      "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/CrossSectionArea",    "gwp_factor": 2.130, "mass_kg": 3400},
        {"element_name": "Chilled water pipes", "ifc_entity": "IfcPipeSegment",   "quantity_value": 280,  "quantity_unit": "m",  "material": "Steel (galv.)",    "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NominalLength",       "gwp_factor": 2.130, "mass_kg": 2520},
        {"element_name": "AHU units",           "ifc_entity": "IfcAirHandlingUnit","quantity_value": 4,   "quantity_unit": "nr", "material": "Steel / Al",       "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NominalAirFlowRate", "gwp_factor": 3.200, "mass_kg": 2400},
    ],
    "CIVIL": [
        {"element_name": "Site roads",          "ifc_entity": "IfcRoad",          "quantity_value": 2400, "quantity_unit": "m2", "material": "Asphalt",          "bsdd_uri": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossArea",           "gwp_factor": 0.062, "mass_kg": 240000},
        {"element_name": "Earthworks cut",      "ifc_entity": "IfcEarthworksCut", "quantity_value": 1800, "quantity_unit": "m3", "material": "Soil removal",     "bsdd_uri": "https://identifier.buildingsmart.org/uri/TUe/DOR/0.0.2/prop/InterventionRequirement",   "gwp_factor": 0.005, "mass_kg": 3240000},
        {"element_name": "Earthworks fill",     "ifc_entity": "IfcEarthworksFill","quantity_value": 950,  "quantity_unit": "m3", "material": "Gravel fill",      "bsdd_uri": "https://identifier.buildingsmart.org/uri/TUe/DOR/0.0.2/prop/InterventionRequirement",   "gwp_factor": 0.007, "mass_kg": 1710000},
    ],
}


@router.post("/api/projects/{project_id}/lca/seed-sample")
def seed_sample_lca(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = db.query(LCAEntry).filter(LCAEntry.project_id == project_id).count()
    if existing > 0:
        raise HTTPException(status_code=400, detail="LCA entries already exist for this project")

    # Find R2 phase (Concept Design)
    r2_phase = db.query(Phase).filter(Phase.project_id == project_id, Phase.code == "R2").first()
    phase_id = r2_phase.id if r2_phase else None
    loin = r2_phase.loin if r2_phase else 2

    disciplines = db.query(Discipline).filter(Discipline.project_id == project_id).all()
    disc_map = {d.code: d.id for d in disciplines}

    created = []
    for disc_code, entries in SAMPLE_LCA.items():
        disc_id = disc_map.get(disc_code)
        for e_data in entries:
            gwp = compute_gwp(e_data, loin)
            entry = LCAEntry(
                project_id=project_id,
                phase_id=phase_id,
                discipline_id=disc_id,
                ifc_entity=e_data["ifc_entity"],
                element_name=e_data["element_name"],
                quantity_value=e_data["quantity_value"],
                quantity_unit=e_data["quantity_unit"],
                material=e_data["material"],
                bsdd_uri=e_data["bsdd_uri"],
                gwp_factor=e_data["gwp_factor"],
                mass_kg=e_data["mass_kg"],
                confidence="order_of_magnitude",
                **gwp,
            )
            entry.flag = validate_lca_entry(entry)
            entry.stage_check = json.dumps(compute_stage_check(entry, loin))
            db.add(entry)
            created.append(entry)

    db.commit()
    return {"ok": True, "count": len(created)}


# --- CRUD ---

@router.get("/api/projects/{project_id}/lca", response_model=List[LCAEntryResponse])
def list_lca_entries(
    project_id: int,
    phase_id: Optional[int] = Query(None),
    discipline_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(LCAEntry).filter(LCAEntry.project_id == project_id)
    if phase_id is not None:
        q = q.filter(LCAEntry.phase_id == phase_id)
    if discipline_id is not None:
        q = q.filter(LCAEntry.discipline_id == discipline_id)
    return q.all()


@router.post("/api/projects/{project_id}/lca", response_model=LCAEntryResponse)
def create_lca_entry(project_id: int, data: LCAEntryCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Determine LOIN from phase
    loin = 2
    if data.phase_id:
        phase = db.query(Phase).filter(Phase.id == data.phase_id).first()
        if phase and phase.loin is not None:
            loin = phase.loin

    gwp = compute_gwp(data.model_dump(), loin)
    entry = LCAEntry(
        project_id=project_id,
        phase_id=data.phase_id,
        discipline_id=data.discipline_id,
        ifc_entity=data.ifc_entity,
        element_name=data.element_name,
        quantity_value=data.quantity_value,
        quantity_unit=data.quantity_unit,
        material=data.material,
        bsdd_uri=data.bsdd_uri,
        gwp_factor=data.gwp_factor,
        mass_kg=data.mass_kg,
        confidence="order_of_magnitude",
        **gwp,
    )
    entry.flag = validate_lca_entry(entry)
    entry.stage_check = json.dumps(compute_stage_check(entry, loin))
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/api/projects/{project_id}/lca/bulk")
def bulk_create_lca(project_id: int, entries: List[LCAEntryCreate], db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    created = []
    for data in entries:
        loin = 2
        if data.phase_id:
            phase = db.query(Phase).filter(Phase.id == data.phase_id).first()
            if phase and phase.loin is not None:
                loin = phase.loin
        gwp = compute_gwp(data.model_dump(), loin)
        entry = LCAEntry(
            project_id=project_id,
            phase_id=data.phase_id,
            discipline_id=data.discipline_id,
            ifc_entity=data.ifc_entity,
            element_name=data.element_name,
            quantity_value=data.quantity_value,
            quantity_unit=data.quantity_unit,
            material=data.material,
            bsdd_uri=data.bsdd_uri,
            gwp_factor=data.gwp_factor,
            mass_kg=data.mass_kg,
            confidence="order_of_magnitude",
            **gwp,
        )
        entry.flag = validate_lca_entry(entry)
        entry.stage_check = json.dumps(compute_stage_check(entry, loin))
        db.add(entry)
        created.append(entry)
    db.commit()
    return {"ok": True, "count": len(created)}


@router.delete("/api/lca/{entry_id}")
def delete_lca_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LCAEntry).filter(LCAEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="LCA entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# --- Validate all entries ---

@router.post("/api/projects/{project_id}/lca/validate")
def validate_all_lca(project_id: int, db: Session = Depends(get_db)):
    entries = db.query(LCAEntry).filter(LCAEntry.project_id == project_id).all()
    results = []
    for entry in entries:
        loin = 2
        if entry.phase_id:
            phase = db.query(Phase).filter(Phase.id == entry.phase_id).first()
            if phase and phase.loin is not None:
                loin = phase.loin
        entry.flag = validate_lca_entry(entry)
        entry.stage_check = json.dumps(compute_stage_check(entry, loin))
        results.append({"id": entry.id, "flag": entry.flag})
    db.commit()
    return {"ok": True, "results": results}


# --- Summary ---

@router.get("/api/projects/{project_id}/lca/summary")
def lca_summary(
    project_id: int,
    phase_id: Optional[int] = Query(None),
    discipline_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    q = db.query(LCAEntry).filter(LCAEntry.project_id == project_id)
    if phase_id is not None:
        q = q.filter(LCAEntry.phase_id == phase_id)
    if discipline_ids:
        disc_id_list = [int(x) for x in discipline_ids.split(",") if x.strip()]
        q = q.filter(LCAEntry.discipline_id.in_(disc_id_list))

    entries = q.all()

    total_mass = sum(e.mass_kg or 0 for e in entries)
    total_a1a3 = sum(e.gwp_a1a3 or 0 for e in entries)
    total_a4a5 = sum(e.gwp_a4a5 or 0 for e in entries)

    # Determine LOIN from selected phase or default
    loin = 2
    if phase_id:
        phase = db.query(Phase).filter(Phase.id == phase_id).first()
        if phase and phase.loin is not None:
            loin = phase.loin

    wlc = total_a1a3 * 2.2  # RICS WLCA guidance for SD

    # EN 15978 stages
    en_stages = {
        "A1-A3": round(total_a1a3, 2) if total_a1a3 else 0,
        "A4-A5": round(total_a4a5, 2) if total_a4a5 else 0,
        "B1-B7": None if loin < 4 else 0.0,
        "C1-C4": None if loin < 4 else 0.0,
        "D": None if loin < 4 else 0.0,
    }

    # By discipline (totals)
    disciplines = db.query(Discipline).filter(Discipline.project_id == project_id).order_by(Discipline.order_index).all()
    by_disc = []
    by_discipline_stages = []
    for d in disciplines:
        d_entries = [e for e in entries if e.discipline_id == d.id]
        a1a3 = sum(e.gwp_a1a3 or 0 for e in d_entries)
        a4a5 = sum(e.gwp_a4a5 or 0 for e in d_entries)
        by_disc.append({
            "code": d.code,
            "name": d.name,
            "color": d.color,
            "gwp_a1a3": round(a1a3, 2),
            "mass_kg": round(sum(e.mass_kg or 0 for e in d_entries), 2),
        })
        by_discipline_stages.append({
            "code": d.code,
            "name": d.name,
            "color": d.color,
            "stages": {
                "A1-A3": round(a1a3, 2) if d_entries else 0.0,
                "A4-A5": round(a4a5, 2) if d_entries else 0.0,
                "B1-B7": None
                if loin < 4
                else round(sum(e.gwp_b1b7 or 0 for e in d_entries), 2),
                "C1-C4": None
                if loin < 4
                else round(sum(e.gwp_c1c4 or 0 for e in d_entries), 2),
                "D": None
                if loin < 4
                else round(sum(e.gwp_d or 0 for e in d_entries), 2),
            },
        })

    # By RIBA phase
    phases = db.query(Phase).filter(Phase.project_id == project_id).order_by(Phase.order_index).all()
    by_phase = []
    for p in phases:
        p_entries = db.query(LCAEntry).filter(LCAEntry.project_id == project_id, LCAEntry.phase_id == p.id).all()
        p_total = sum(e.gwp_a1a3 or 0 for e in p_entries) if p_entries else None
        by_phase.append({
            "phase_code": p.code or f"P{p.order_index}",
            "phase_name": p.name,
            "gwp_total": round(p_total, 2) if p_total else None,
            "confidence": p_entries[0].confidence if p_entries else None,
        })

    # Top contributor
    top = None
    if entries:
        top_entry = max(entries, key=lambda e: e.gwp_a1a3 or 0)
        disc = db.query(Discipline).filter(Discipline.id == top_entry.discipline_id).first() if top_entry.discipline_id else None
        top = {
            "element_name": top_entry.element_name,
            "gwp_a1a3": round(top_entry.gwp_a1a3 or 0, 2),
            "discipline": disc.code if disc else "N/A",
        }

    confidence = entries[0].confidence if entries else "order_of_magnitude"

    return {
        "ils17_mass_kg": round(total_mass, 2),
        "ils18_gwp_a1a3": round(total_a1a3, 2),
        "ils19_wlc_estimate": round(wlc, 2),
        "confidence": confidence,
        "loin_level": loin,
        "en15978_stages": en_stages,
        "by_discipline": by_disc,
        "by_discipline_stages": by_discipline_stages,
        "by_riba_phase": by_phase,
        "top_contributor": top,
    }

import json
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Project, Phase, Discipline, LCAEntry, LCACheckRun
from lca_checker import run_lca_check

router = APIRouter(tags=["lca-check"])


@router.post("/api/projects/{project_id}/lca-check/{phase_id}")
def run_check(project_id: int, phase_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")

    entries = db.query(LCAEntry).filter(
        LCAEntry.project_id == project_id,
        LCAEntry.phase_id == phase_id,
    ).all()

    # Also include entries without a phase assigned
    unassigned = db.query(LCAEntry).filter(
        LCAEntry.project_id == project_id,
        LCAEntry.phase_id.is_(None),
    ).all()
    all_entries = entries + unassigned

    if not all_entries:
        # Still run check on all project entries if none assigned to this phase
        all_entries = db.query(LCAEntry).filter(LCAEntry.project_id == project_id).all()

    disciplines = db.query(Discipline).filter(Discipline.project_id == project_id).all()
    disc_map = {d.id: d for d in disciplines}

    result = run_lca_check(
        project_id=project_id,
        phase_id=phase_id,
        phase_name=phase.name,
        phase_gate=phase.gate or "",
        loin_level=phase.loin or 2,
        lca_entries=all_entries,
        disciplines_map=disc_map,
    )

    # Store in DB
    run = LCACheckRun(
        project_id=project_id,
        phase_id=phase_id,
        status="complete",
        total_elements=result.total_elements,
        pass_count=result.pass_count,
        warn_count=result.warn_count,
        fail_count=result.fail_count,
        skip_count=result.skip_count,
        total_gwp_a1a3=result.total_gwp_a1a3,
        total_gwp_wlc=result.total_gwp_wlc,
        total_mass_kg=result.total_mass_kg,
        loin_level=result.loin_level,
        confidence=result.elements[0].confidence if result.elements else "order_of_magnitude",
        results_json=json.dumps(asdict(result), default=str),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return asdict(result) | {"id": run.id}


@router.get("/api/projects/{project_id}/lca-checks")
def list_checks(project_id: int, db: Session = Depends(get_db)):
    runs = (
        db.query(LCACheckRun)
        .filter(LCACheckRun.project_id == project_id)
        .order_by(LCACheckRun.run_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "phase_id": r.phase_id,
            "run_at": r.run_at.isoformat() if r.run_at else None,
            "status": r.status,
            "total_elements": r.total_elements,
            "pass_count": r.pass_count,
            "warn_count": r.warn_count,
            "fail_count": r.fail_count,
            "skip_count": r.skip_count,
            "total_gwp_a1a3": r.total_gwp_a1a3,
            "total_gwp_wlc": r.total_gwp_wlc,
            "total_mass_kg": r.total_mass_kg,
            "loin_level": r.loin_level,
            "confidence": r.confidence,
        }
        for r in runs
    ]


@router.get("/api/projects/{project_id}/lca-checks/{check_id}")
def get_check(project_id: int, check_id: int, db: Session = Depends(get_db)):
    run = (
        db.query(LCACheckRun)
        .filter(LCACheckRun.id == check_id, LCACheckRun.project_id == project_id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Check run not found")
    try:
        full = json.loads(run.results_json or "{}")
    except json.JSONDecodeError:
        full = {}
    return {
        "id": run.id,
        "project_id": run.project_id,
        "phase_id": run.phase_id,
        "run_at": run.run_at.isoformat() if run.run_at else None,
        "status": run.status,
        **full,
    }


@router.delete("/api/projects/{project_id}/lca-checks/{check_id}")
def delete_check(project_id: int, check_id: int, db: Session = Depends(get_db)):
    run = (
        db.query(LCACheckRun)
        .filter(LCACheckRun.id == check_id, LCACheckRun.project_id == project_id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Check run not found")
    db.delete(run)
    db.commit()
    return {"ok": True}

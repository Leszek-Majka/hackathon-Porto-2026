"""Dashboard router — maturity metrics and PDF report."""
import json
import os
import re
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from database import get_db
from models import Project, ValidationRun, PhaseMatrix

router = APIRouter(prefix="/api/projects", tags=["dashboard"])

EXPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "exports")


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


@router.get("/{project_id}/dashboard", response_model=None)
def get_dashboard(project_id: int, db: Session = Depends(get_db)):
    """Return all data needed for the maturity dashboard."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    specs = []
    total_reqs = 0
    if project.ids_file:
        parsed = json.loads(project.ids_file.parsed_json)
        specs = parsed.get("specifications", [])
        total_reqs = sum(len(s.get("requirements", [])) for s in specs)

    # Build matrix lookup
    entries = db.query(PhaseMatrix).filter(PhaseMatrix.project_id == project_id).all()
    matrix: dict = {}
    for e in entries:
        matrix.setdefault(e.spec_id, {}).setdefault(e.requirement_key, {})[str(e.phase_id)] = e.status

    phases = sorted(project.phases, key=lambda p: p.order_index)

    # Maturity chart data (per phase: required/optional/excluded counts)
    maturity_chart = []
    for ph in phases:
        req_c = opt_c = exc_c = 0
        for spec in specs:
            for req in spec.get("requirements", []):
                status = matrix.get(spec["id"], {}).get(req["key"], {}).get(str(ph.id), req.get("baseStatus", "required"))
                if status == "required":
                    req_c += 1
                elif status == "optional":
                    opt_c += 1
                else:
                    exc_c += 1
        maturity_chart.append({
            "phase": ph.name,
            "phase_id": ph.id,
            "color": ph.color,
            "required": req_c,
            "optional": opt_c,
            "excluded": exc_c,
        })

    # Validation runs
    runs = db.query(ValidationRun).filter(
        ValidationRun.project_id == project_id,
        ValidationRun.status == "complete",
    ).order_by(ValidationRun.run_at).all()

    # Validation progress chart
    phase_map = {ph.id: ph for ph in phases}
    progress_by_phase: dict = {}
    for run in runs:
        ph = phase_map.get(run.phase_id)
        if not ph:
            continue
        summary = json.loads(run.summary_json or "{}")
        key = str(run.phase_id)
        if key not in progress_by_phase:
            progress_by_phase[key] = {
                "phase_id": ph.id,
                "phase_name": ph.name,
                "color": ph.color,
                "data": [],
            }
        progress_by_phase[key]["data"].append({
            "timestamp": run.run_at.isoformat(),
            "pass_rate": summary.get("pass_rate", 0),
        })

    # Heatmap: spec × phase → latest pass rate
    heatmap = []
    latest_by_phase: dict = {}
    for run in reversed(runs):
        if run.phase_id not in latest_by_phase:
            latest_by_phase[run.phase_id] = run

    for spec in specs:
        row = {"spec_id": spec["id"], "spec_name": spec["name"], "cells": []}
        for ph in phases:
            latest = latest_by_phase.get(ph.id)
            pass_rate = None
            run_id = None
            if latest:
                results = json.loads(latest.results_json or "{}")
                for sr in results.get("specs", []):
                    if sr["spec_id"] == spec["id"]:
                        total = sr.get("elements_checked", 0)
                        passing = sr.get("elements_passing", 0)
                        pass_rate = round(passing / total, 4) if total > 0 else None
                        run_id = latest.id
                        break
            row["cells"].append({
                "phase_id": ph.id,
                "phase_name": ph.name,
                "pass_rate": pass_rate,
                "run_id": run_id,
            })
        heatmap.append(row)

    # Metric cards
    latest_pass_rate = None
    most_problematic = None
    if latest_by_phase:
        # pick the most recent run overall
        all_latest = list(latest_by_phase.values())
        newest = max(all_latest, key=lambda r: r.run_at)
        summary = json.loads(newest.summary_json or "{}")
        latest_pass_rate = summary.get("pass_rate")
        results = json.loads(newest.results_json or "{}")
        worst = max(results.get("specs", []), key=lambda s: len(s.get("failures", [])), default=None)
        if worst and worst.get("failures"):
            most_problematic = worst.get("spec_name")

    return {
        "metric_cards": {
            "total_specs": len(specs),
            "total_requirements": total_reqs,
            "phases_defined": len(phases),
            "latest_pass_rate": latest_pass_rate,
            "most_problematic_spec": most_problematic,
        },
        "maturity_chart": maturity_chart,
        "validation_progress": list(progress_by_phase.values()),
        "heatmap": heatmap,
    }


@router.get("/{project_id}/report/pdf")
def export_pdf(
    project_id: int,
    phase_id: Optional[int] = Query(None),
    lang: str = Query("en"),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ids_info = {}
    specs = []
    if project.ids_file:
        parsed = json.loads(project.ids_file.parsed_json)
        ids_info = parsed.get("info", {})
        specs = parsed.get("specifications", [])

    entries = db.query(PhaseMatrix).filter(PhaseMatrix.project_id == project_id).all()
    matrix_data: dict = {}
    for e in entries:
        matrix_data.setdefault(e.spec_id, {}).setdefault(e.requirement_key, {})[str(e.phase_id)] = e.status

    phases = [
        {"id": p.id, "name": p.name, "color": p.color, "order_index": p.order_index}
        for p in sorted(project.phases, key=lambda p: p.order_index)
    ]

    runs = db.query(ValidationRun).filter(ValidationRun.project_id == project_id).all()
    runs_data = [
        {
            "id": r.id,
            "phase_id": r.phase_id,
            "status": r.status,
            "run_at": r.run_at.isoformat(),
            "summary_json": r.summary_json,
            "results_json": r.results_json,
        }
        for r in runs
    ]

    try:
        from pdf_reporter import generate_report
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed")

    os.makedirs(EXPORTS_DIR, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    filename = f"{slugify(project.name)}_maturity-report_{today}.pdf"
    output_path = os.path.join(EXPORTS_DIR, filename)

    generate_report(
        output_path=output_path,
        project_name=project.name,
        ids_info=ids_info,
        phases=phases,
        matrix_data=matrix_data,
        specs=specs,
        validation_runs=runs_data,
        lang=lang,
        phase_id=phase_id,
    )

    with open(output_path, "rb") as f:
        content = f.read()

    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

"""PDF report generator using reportlab."""
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

from i18n import t, SUPPORTED_LANGUAGES

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_report(
    output_path: str,
    project_name: str,
    ids_info: Dict,
    phases: List[Dict],
    matrix_data: Dict,   # {spec_id: {req_key: {phase_id: status}}}
    specs: List[Dict],
    validation_runs: List[Dict],
    lang: str = "en",
    phase_id: Optional[int] = None,
) -> str:
    """Generate PDF maturity report. Returns output_path."""
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab not installed. Run: pip install reportlab")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, spaceAfter=6)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceAfter=4, spaceBefore=12)
    normal_style = styles["Normal"]
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    story = []

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(t(lang, "report_title"), title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#3B82F6")))
    story.append(Spacer(1, 0.5 * cm))

    meta_data = [
        [t(lang, "project"), project_name],
        [t(lang, "ids_title"), ids_info.get("title") or "—"],
        [t(lang, "ids_version"), ids_info.get("version") or "—"],
        [t(lang, "author"), ids_info.get("author") or "—"],
        [t(lang, "generated_on"), datetime.now().strftime("%Y-%m-%d %H:%M")],
    ]
    meta_table = Table(meta_data, colWidths=[4 * cm, 13 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#374151")),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.8 * cm))

    # ── Phase Overview Table ─────────────────────────────────────────────────
    target_phases = [p for p in phases if phase_id is None or p["id"] == phase_id]

    story.append(Paragraph(t(lang, "phase_overview"), h2_style))

    phase_header = [
        t(lang, "phase"),
        t(lang, "required"),
        t(lang, "optional"),
        t(lang, "excluded"),
    ]
    phase_rows = [phase_header]

    for ph in sorted(target_phases, key=lambda p: p.get("order_index", 0)):
        req_c = opt_c = exc_c = 0
        for spec in specs:
            spec_id = spec["id"]
            for req in spec.get("requirements", []):
                rk = req["key"]
                status = matrix_data.get(spec_id, {}).get(rk, {}).get(str(ph["id"]), req.get("baseStatus", "required"))
                if status == "required":
                    req_c += 1
                elif status == "optional":
                    opt_c += 1
                else:
                    exc_c += 1
        phase_rows.append([ph["name"], str(req_c), str(opt_c), str(exc_c)])

    pt = Table(phase_rows, colWidths=[6 * cm, 3 * cm, 3 * cm, 3 * cm])
    pt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF6FF")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    story.append(pt)
    story.append(Spacer(1, 0.5 * cm))

    # ── Validation Summary ───────────────────────────────────────────────────
    relevant_runs = [
        r for r in validation_runs
        if r.get("status") == "complete" and (phase_id is None or r.get("phase_id") == phase_id)
    ]

    if relevant_runs:
        story.append(Paragraph(t(lang, "validation_summary"), h2_style))

        val_header = [
            t(lang, "phase"),
            t(lang, "elements_checked"),
            t(lang, "elements_passing"),
            t(lang, "pass_rate"),
        ]
        val_rows = [val_header]

        phase_map = {p["id"]: p["name"] for p in phases}
        for run in relevant_runs:
            summary = json.loads(run.get("summary_json", "{}"))
            ph_name = phase_map.get(run.get("phase_id"), "?")
            pass_rate = summary.get("pass_rate", 0)
            val_rows.append([
                ph_name,
                str(summary.get("total_elements", 0)),
                str(summary.get("passing_elements", 0)),
                f"{pass_rate * 100:.1f}%",
            ])

        vt = Table(val_rows, colWidths=[5 * cm, 4 * cm, 4 * cm, 4 * cm])
        vt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F0FDF4")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]))
        story.append(vt)
        story.append(Spacer(1, 0.5 * cm))

        # Failing elements per spec
        for run in relevant_runs:
            results = json.loads(run.get("results_json", "{}"))
            ph_name = phase_map.get(run.get("phase_id"), "?")
            for spec_result in results.get("specs", []):
                failures = spec_result.get("failures", [])
                if not failures:
                    continue
                story.append(Paragraph(
                    f"{t(lang, 'specification')}: {spec_result['spec_name']} — {ph_name}",
                    h2_style,
                ))
                fail_header = [
                    t(lang, "element_id"),
                    t(lang, "element_type"),
                    t(lang, "element_name"),
                    t(lang, "failed_requirements"),
                ]
                fail_rows = [fail_header]
                for f in failures:
                    fail_rows.append([
                        f.get("element_id", ""),
                        f.get("element_type", ""),
                        f.get("element_name", ""),
                        ", ".join(f.get("failed_requirements", [])),
                    ])
                ft = Table(fail_rows, colWidths=[3 * cm, 3 * cm, 4 * cm, 7 * cm])
                ft.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FEF2F2")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("WORDWRAP", (3, 1), (3, -1), True),
                ]))
                story.append(ft)
                story.append(Spacer(1, 0.3 * cm))
    else:
        story.append(Paragraph(t(lang, "validation_summary"), h2_style))
        story.append(Paragraph(t(lang, "no_validation"), normal_style))

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#D1D5DB")))
    lang_label = SUPPORTED_LANGUAGES.get(lang, lang)
    story.append(Paragraph(
        f"{t(lang, 'report_language')}: {lang_label} ({lang}) | {t(lang, 'generated_on')}: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        small_style,
    ))

    doc.build(story)
    return output_path

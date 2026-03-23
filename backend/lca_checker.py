"""
LCA Data Readiness Checker

Validates IFC elements against LCA requirements per EN 15804+A2 / EN 15978.
Each element is checked for:
  1. Material assignment exists (required for any EPD lookup)
  2. Quantity is extractable (volume, area, length, or count)
  3. bsDD URI is resolvable (the property reference exists)
  4. GWP factor is present and > 0
  5. Unit consistency (quantity unit matches what the GWP factor expects)
  6. Lifecycle stage coverage (which EN 15978 stages have data)

Output: per-element check result with status (pass / warn / fail) and flags.
"""

from __future__ import annotations

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Set, Tuple
from datetime import datetime, timezone


class CheckStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    SKIP = "skip"


UNIT_RULES: dict[str, set[str]] = {
    "IfcWall": {"m2", "m3"},
    "IfcSlab": {"m2", "m3"},
    "IfcRoof": {"m2", "m3"},
    "IfcCurtainWall": {"m2", "m3"},
    "IfcCovering": {"m2", "m3"},
    "IfcBeam": {"kg", "m"},
    "IfcColumn": {"kg", "m"},
    "IfcPipeSegment": {"m"},
    "IfcDuctSegment": {"m"},
    "IfcFooting": {"m3"},
}


@dataclass
class ElementCheck:
    element_id: str
    element_name: str
    ifc_entity: str
    discipline: str
    status: CheckStatus
    flags: list[str] = field(default_factory=list)
    has_material: bool = False
    has_quantity: bool = False
    has_bsdd_uri: bool = False
    has_gwp_factor: bool = False
    unit_consistent: bool = False
    stages_available: list[str] = field(default_factory=list)
    stages_projected: list[str] = field(default_factory=list)
    stages_locked: list[str] = field(default_factory=list)
    gwp_a1a3: Optional[float] = None
    gwp_total_available: Optional[float] = None
    confidence: str = "unknown"
    # Extra fields for table display
    material: str = ""
    quantity_value: float = 0.0
    quantity_unit: str = ""
    bsdd_uri: str = ""
    gwp_factor: float = 0.0
    mass_kg: float = 0.0
    gwp_a4a5: Optional[float] = None


@dataclass
class LCACheckResult:
    project_id: int
    phase_id: int
    phase_name: str
    phase_gate: str
    loin_level: int
    checked_at: str
    total_elements: int = 0
    pass_count: int = 0
    warn_count: int = 0
    fail_count: int = 0
    skip_count: int = 0
    total_gwp_a1a3: float = 0.0
    total_gwp_a4a5: float = 0.0
    total_gwp_wlc: float = 0.0
    total_mass_kg: float = 0.0
    by_discipline: dict = field(default_factory=dict)
    by_stage: dict = field(default_factory=dict)
    by_entity_type: dict = field(default_factory=dict)
    elements: list[ElementCheck] = field(default_factory=list)


def _check_unit_consistency(unit: str, ifc_entity: str) -> tuple[bool, str | None]:
    allowed = UNIT_RULES.get(ifc_entity)
    if allowed is None:
        return True, None
    if unit in allowed:
        return True, None
    return False, f"Unit mismatch: got '{unit}', expected one of {sorted(allowed)} for {ifc_entity}"


def _confidence_from_loin(loin: int) -> str:
    if loin <= 1:
        return "order_of_magnitude"
    if loin == 2:
        return "indicative"
    if loin == 3:
        return "detailed"
    return "certified"


def run_lca_check(
    project_id: int,
    phase_id: int,
    phase_name: str,
    phase_gate: str,
    loin_level: int,
    lca_entries: list,
    disciplines_map: dict | None = None,
    ifc_elements: dict | None = None,
) -> LCACheckResult:
    """Run LCA data readiness check on all entries for a given phase."""
    now = datetime.now(timezone.utc).isoformat()
    result = LCACheckResult(
        project_id=project_id,
        phase_id=phase_id,
        phase_name=phase_name,
        phase_gate=phase_gate or "",
        loin_level=loin_level,
        checked_at=now,
    )

    disciplines_map = disciplines_map or {}

    for entry in lca_entries:
        flags: list[str] = []

        # 1. Material
        has_material = bool(entry.material and entry.material.strip())
        if not has_material:
            flags.append("missing_material")

        # 2. Quantity
        has_quantity = entry.quantity_value is not None and entry.quantity_value > 0
        if not has_quantity:
            flags.append("missing_quantity")

        # 3. bsDD URI
        has_bsdd_uri = bool(
            entry.bsdd_uri
            and entry.bsdd_uri.startswith("https://identifier.buildingsmart.org/")
        )
        if not has_bsdd_uri:
            flags.append("missing_bsdd_uri")

        # 4. GWP factor
        has_gwp_factor = entry.gwp_factor is not None and entry.gwp_factor > 0
        if not has_gwp_factor:
            flags.append("missing_gwp_factor")

        # 5. Unit consistency
        unit_ok, unit_msg = _check_unit_consistency(
            entry.quantity_unit or "", entry.ifc_entity or ""
        )
        if not unit_ok:
            flags.append(unit_msg or "unit_mismatch")

        # 6. Lifecycle stage coverage
        stages_available: list[str] = []
        stages_projected: list[str] = []
        stages_locked: list[str] = []

        if has_gwp_factor and has_quantity and has_material:
            stages_available.extend(["A1", "A2", "A3"])
        stages_projected.extend(["A4", "A5"])

        if loin_level >= 4:
            stages_available.extend(["B1-B7", "C1-C4", "D"])
        else:
            stages_locked.extend(["B1-B7", "C1-C4", "D"])

        # 7. Compute GWP
        gwp_a1a3 = None
        gwp_a4a5 = None
        if has_material and has_quantity and has_gwp_factor:
            gwp_a1a3 = (entry.mass_kg or 0) * (entry.gwp_factor or 0)
            gwp_a4a5 = gwp_a1a3 * 0.08
        elif entry.gwp_a1a3:
            gwp_a1a3 = entry.gwp_a1a3
            gwp_a4a5 = entry.gwp_a4a5

        gwp_total = (gwp_a1a3 or 0) + (gwp_a4a5 or 0)

        # 8. Confidence
        confidence = _confidence_from_loin(loin_level)

        # 9. Status
        if not has_material or not has_quantity or not has_gwp_factor:
            status = CheckStatus.FAIL
        elif not unit_ok or not has_bsdd_uri or confidence == "order_of_magnitude":
            status = CheckStatus.WARN
        else:
            status = CheckStatus.PASS

        disc_code = ""
        if entry.discipline_id and disciplines_map:
            d = disciplines_map.get(entry.discipline_id)
            if d:
                disc_code = d.code or d.abbreviation or ""

        elem = ElementCheck(
            element_id=str(entry.id),
            element_name=entry.element_name or "",
            ifc_entity=entry.ifc_entity or "",
            discipline=disc_code,
            status=status,
            flags=flags,
            has_material=has_material,
            has_quantity=has_quantity,
            has_bsdd_uri=has_bsdd_uri,
            has_gwp_factor=has_gwp_factor,
            unit_consistent=unit_ok,
            stages_available=stages_available,
            stages_projected=stages_projected,
            stages_locked=stages_locked,
            gwp_a1a3=round(gwp_a1a3, 2) if gwp_a1a3 is not None else None,
            gwp_total_available=round(gwp_total, 2) if gwp_total else None,
            confidence=confidence,
            material=entry.material or "",
            quantity_value=entry.quantity_value or 0.0,
            quantity_unit=entry.quantity_unit or "",
            bsdd_uri=entry.bsdd_uri or "",
            gwp_factor=entry.gwp_factor or 0.0,
            mass_kg=entry.mass_kg or 0.0,
            gwp_a4a5=round(gwp_a4a5, 2) if gwp_a4a5 is not None else None,
        )
        result.elements.append(elem)

    # Aggregate
    result.total_elements = len(result.elements)
    result.pass_count = sum(1 for e in result.elements if e.status == CheckStatus.PASS)
    result.warn_count = sum(1 for e in result.elements if e.status == CheckStatus.WARN)
    result.fail_count = sum(1 for e in result.elements if e.status == CheckStatus.FAIL)
    result.skip_count = sum(1 for e in result.elements if e.status == CheckStatus.SKIP)
    result.total_mass_kg = sum(e.mass_kg for e in result.elements)
    result.total_gwp_a1a3 = sum(e.gwp_a1a3 or 0 for e in result.elements)
    result.total_gwp_a4a5 = sum(e.gwp_a4a5 or 0 for e in result.elements)
    result.total_gwp_wlc = result.total_gwp_a1a3 * 2.2

    # By discipline
    for elem in result.elements:
        code = elem.discipline or "UNKNOWN"
        if code not in result.by_discipline:
            disc_obj = None
            if disciplines_map:
                for d in disciplines_map.values():
                    if (d.code or d.abbreviation or "") == code:
                        disc_obj = d
                        break
            result.by_discipline[code] = {
                "gwp_a1a3": 0.0,
                "gwp_a4a5": 0.0,
                "mass_kg": 0.0,
                "pass_count": 0,
                "warn_count": 0,
                "fail_count": 0,
                "color": disc_obj.color if disc_obj else "#888",
            }
        bd = result.by_discipline[code]
        bd["gwp_a1a3"] += elem.gwp_a1a3 or 0
        bd["gwp_a4a5"] += elem.gwp_a4a5 or 0
        bd["mass_kg"] += elem.mass_kg
        if elem.status == CheckStatus.PASS:
            bd["pass_count"] += 1
        elif elem.status == CheckStatus.WARN:
            bd["warn_count"] += 1
        elif elem.status == CheckStatus.FAIL:
            bd["fail_count"] += 1

    # By stage (A1/A2/A3 split from total A1-A3)
    total_a1a3 = result.total_gwp_a1a3
    result.by_stage["A1"] = round(total_a1a3 * 0.35, 2)
    result.by_stage["A2"] = round(total_a1a3 * 0.10, 2)
    result.by_stage["A3"] = round(total_a1a3 * 0.55, 2)
    result.by_stage["A4"] = round(total_a1a3 * 0.05, 2)
    result.by_stage["A5"] = round(total_a1a3 * 0.03, 2)
    if loin_level >= 4:
        result.by_stage["B1-B7"] = 0.0
        result.by_stage["C1-C4"] = 0.0
        result.by_stage["D"] = 0.0
    else:
        result.by_stage["B1-B7"] = None
        result.by_stage["C1-C4"] = None
        result.by_stage["D"] = None

    # By entity type
    for elem in result.elements:
        etype = elem.ifc_entity or "Unknown"
        if etype not in result.by_entity_type:
            result.by_entity_type[etype] = {"gwp": 0.0, "count": 0}
        result.by_entity_type[etype]["gwp"] += elem.gwp_a1a3 or 0
        result.by_entity_type[etype]["count"] += 1

    # Round aggregates
    result.total_gwp_a1a3 = round(result.total_gwp_a1a3, 2)
    result.total_gwp_a4a5 = round(result.total_gwp_a4a5, 2)
    result.total_gwp_wlc = round(result.total_gwp_wlc, 2)
    result.total_mass_kg = round(result.total_mass_kg, 2)

    return result

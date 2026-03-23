"""Extract per-element volume, GWP, and cost data from an IFC file."""

import ifcopenshell
import ifcopenshell.util.element as elem_util


def extract_lca_cost_data(ifc_path: str) -> list[dict]:
    """Extract per-element volume, GWP, and cost data from IFC."""
    model = ifcopenshell.open(ifc_path)
    results = []

    for product in model.by_type("IfcProduct"):
        if product.is_a("IfcSpatialStructureElement"):
            continue

        psets = elem_util.get_psets(product)
        env = psets.get("Pset_EnvironmentalImpactIndicators", {})

        qtos = {}
        for rel in getattr(product, "IsDefinedBy", []):
            if rel.is_a("IfcRelDefinesByProperties"):
                pdef = rel.RelatingPropertyDefinition
                if pdef.is_a("IfcElementQuantity"):
                    for q in pdef.Quantities:
                        if hasattr(q, "VolumeValue"):
                            qtos["volume"] = q.VolumeValue
                        elif hasattr(q, "AreaValue"):
                            qtos["area"] = q.AreaValue

        cost_data = _extract_cost_items(model, product)

        results.append({
            "global_id": product.GlobalId,
            "name": product.Name or "",
            "type": product.is_a(),
            "volume_m3": qtos.get("volume", 0),
            "area_m2": qtos.get("area", 0),
            "gwp_value": env.get("TotalPrimaryEnergyConsumptionPerUnit", 0),
            "cost_items": cost_data,
            "material": _get_material_name(product),
        })

    return results


def _extract_cost_items(model, product) -> list[dict]:
    """Find IfcCostItem entities assigned to this product."""
    costs = []
    for rel in model.by_type("IfcRelAssignsToControl"):
        if product in (rel.RelatedObjects or []):
            ctrl = rel.RelatingControl
            if ctrl and ctrl.is_a("IfcCostItem"):
                for cv in (ctrl.CostValues or []):
                    applied = cv.AppliedValue
                    value = 0.0
                    if applied and hasattr(applied, "wrappedValue"):
                        value = float(applied.wrappedValue)
                    costs.append({
                        "name": cv.Name or "",
                        "category": cv.Category or "",
                        "value": value,
                    })
    return costs


def _get_material_name(product) -> str:
    for rel in getattr(product, "HasAssociations", []):
        if rel.is_a("IfcRelAssociatesMaterial"):
            mat = rel.RelatingMaterial
            if hasattr(mat, "Name"):
                return mat.Name or ""
            if hasattr(mat, "ForLayerSet"):
                layers = mat.ForLayerSet.MaterialLayers
                if layers:
                    return layers[0].Material.Name or ""
    return ""


# Fallback material-based cost/GWP lookup for elements without IFC cost data
MATERIAL_DEFAULTS = {
    "concrete": {"gwp_kgco2e_m3": 250, "cost_per_m3": 150, "maint_pct": 0.005, "repl_year": None, "repl_pct": 0},
    "steel": {"gwp_kgco2e_m3": 1200, "cost_per_m3": 800, "maint_pct": 0.01, "repl_year": 30, "repl_pct": 0.1},
    "timber": {"gwp_kgco2e_m3": -500, "cost_per_m3": 400, "maint_pct": 0.02, "repl_year": 25, "repl_pct": 0.15},
    "glass": {"gwp_kgco2e_m3": 1800, "cost_per_m3": 1200, "maint_pct": 0.015, "repl_year": 25, "repl_pct": 0.2},
    "brick": {"gwp_kgco2e_m3": 200, "cost_per_m3": 120, "maint_pct": 0.005, "repl_year": None, "repl_pct": 0},
    "aluminium": {"gwp_kgco2e_m3": 8000, "cost_per_m3": 2000, "maint_pct": 0.01, "repl_year": 30, "repl_pct": 0.1},
    "copper": {"gwp_kgco2e_m3": 3500, "cost_per_m3": 1500, "maint_pct": 0.008, "repl_year": 40, "repl_pct": 0.05},
    "asphalt": {"gwp_kgco2e_m3": 50, "cost_per_m3": 80, "maint_pct": 0.03, "repl_year": 15, "repl_pct": 0.5},
}

DEFAULT_FALLBACK = {"gwp_kgco2e_m3": 300, "cost_per_m3": 200, "maint_pct": 0.01, "repl_year": 30, "repl_pct": 0.1}


def enrich_assemblies(raw_elements: list[dict]) -> list[dict]:
    """Convert raw IFC extraction to enriched assembly records with cost/GWP estimates."""
    assemblies = []
    for el in raw_elements:
        vol = el.get("volume_m3", 0) or 0
        if vol <= 0:
            continue

        mat_name = (el.get("material") or "").lower()
        lookup = DEFAULT_FALLBACK
        for key, val in MATERIAL_DEFAULTS.items():
            if key in mat_name:
                lookup = val
                break

        gwp_from_ifc = el.get("gwp_value", 0) or 0
        gwp = gwp_from_ifc if gwp_from_ifc > 0 else lookup["gwp_kgco2e_m3"]

        cost_items = el.get("cost_items", [])
        capital = sum(c["value"] for c in cost_items) if cost_items else vol * lookup["cost_per_m3"]

        assemblies.append({
            "global_id": el["global_id"],
            "name": el["name"],
            "type": el["type"],
            "volume_m3": round(vol, 3),
            "gwp_kgco2e_m3": round(gwp, 2),
            "cost_capital": round(capital, 2),
            "cost_maint_annual": round(capital * lookup["maint_pct"], 2),
            "replacement_year": lookup["repl_year"],
            "replacement_pct": lookup["repl_pct"],
            "energy_impact_kwh": round(vol * 15, 2),  # rough estimate: 15 kWh/m3/yr operational
            "material": el.get("material", ""),
        })

    return assemblies

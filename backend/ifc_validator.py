"""IFC validation engine using ifcopenshell."""
import json
from typing import Any, Dict, List, Optional

try:
    import ifcopenshell
    IFC_AVAILABLE = True
except ImportError:
    IFC_AVAILABLE = False


def _get_property_value(element: Any, pset_name: str, prop_name: str) -> Optional[Any]:
    """Return property value from a Pset, or None if not found."""
    for rel in getattr(element, "IsDefinedBy", []):
        if rel.is_a("IfcRelDefinesByProperties"):
            pset = rel.RelatingPropertyDefinition
            if getattr(pset, "Name", None) == pset_name:
                for prop in getattr(pset, "HasProperties", []):
                    if prop.Name == prop_name:
                        return getattr(prop, "NominalValue", None)
    return None


def _has_material(element: Any) -> bool:
    for rel in getattr(element, "HasAssociations", []):
        if rel.is_a("IfcRelAssociatesMaterial"):
            return True
    return False


def _has_classification(element: Any) -> bool:
    for rel in getattr(element, "HasAssociations", []):
        if rel.is_a("IfcRelAssociatesClassification"):
            return True
    return False


def _check_requirement(element: Any, req: Dict) -> bool:
    """Return True if element satisfies the requirement."""
    req_type = req.get("type")

    if req_type == "attribute":
        name_constraint = req.get("name") or {}
        attr_name = name_constraint.get("value") if name_constraint else None
        if not attr_name:
            return True
        val = getattr(element, attr_name, None)
        return val is not None and val != ""

    elif req_type == "property":
        ps = req.get("propertySet") or {}
        bn = req.get("baseName") or {}
        pset_name = ps.get("value") if ps else None
        prop_name = bn.get("value") if bn else None
        if not pset_name or not prop_name:
            return True
        return _get_property_value(element, pset_name, prop_name) is not None

    elif req_type == "material":
        return _has_material(element)

    elif req_type == "classification":
        return _has_classification(element)

    # partOf and others — skip
    return True


def _get_elements_for_spec(ifc_file: Any, applicability: Dict) -> List[Any]:
    """Get IFC elements matching the applicability filter."""
    entity_info = applicability.get("entity")
    if not entity_info:
        return []

    name_constraint = entity_info.get("name") or {}
    entity_name = name_constraint.get("value") if name_constraint else None
    if not entity_name:
        return []

    try:
        elements = ifc_file.by_type(entity_name)
    except Exception:
        return []

    # Filter by predefined type if specified
    predef = entity_info.get("predefinedType") or {}
    predef_val = predef.get("value") if predef else None
    if predef_val:
        elements = [
            e for e in elements
            if getattr(e, "PredefinedType", None) == predef_val
        ]

    return elements


def validate_ifc(
    ifc_path: str,
    parsed_ids: Dict,
    phase_matrix: Dict[str, Dict[str, str]],  # {spec_id: {req_key: status}}
) -> Dict:
    """
    Validate IFC file against IDS specs filtered by phase matrix.
    Returns structured result dict.
    """
    if not IFC_AVAILABLE:
        return {"error": "ifcopenshell not installed", "specs": []}

    try:
        ifc_file = ifcopenshell.open(ifc_path)
    except Exception as e:
        return {"error": str(e), "specs": []}

    specs_results = []
    total_elements = 0
    total_passing = 0
    total_failing = 0

    for spec in parsed_ids.get("specifications", []):
        spec_id = spec["id"]
        spec_name = spec["name"]
        applicability = spec.get("applicability", {})
        requirements = spec.get("requirements", [])
        spec_matrix = phase_matrix.get(spec_id, {})

        elements = _get_elements_for_spec(ifc_file, applicability)
        elements_checked = len(elements)
        total_elements += elements_checked

        failures = []
        passing_count = 0

        for element in elements:
            failed_reqs = []

            for req in requirements:
                req_key = req["key"]
                status = spec_matrix.get(req_key, req.get("baseStatus", "required"))

                if status == "excluded":
                    continue

                passed = _check_requirement(element, req)

                if not passed:
                    req_label = _req_label(req)
                    if status == "required":
                        failed_reqs.append(req_label)
                    # optional failures are noted but don't count as failure

            if failed_reqs:
                failures.append({
                    "element_id": f"#{element.id()}",
                    "element_type": element.is_a(),
                    "element_name": getattr(element, "Name", "") or "",
                    "global_id": getattr(element, "GlobalId", "") or "",
                    "failed_requirements": failed_reqs,
                })
                total_failing += 1
            else:
                passing_count += 1
                total_passing += 1

        specs_results.append({
            "spec_id": spec_id,
            "spec_name": spec_name,
            "elements_checked": elements_checked,
            "elements_passing": passing_count,
            "failures": failures,
        })

    pass_rate = round(total_passing / total_elements, 4) if total_elements > 0 else 1.0

    summary = {
        "total_elements": total_elements,
        "passing_elements": total_passing,
        "failing_elements": total_failing,
        "pass_rate": pass_rate,
    }

    return {"summary": summary, "specs": specs_results}


def _req_label(req: Dict) -> str:
    req_type = req.get("type", "")
    if req_type == "attribute":
        name = req.get("name") or {}
        return name.get("value", req.get("key", req_type))
    if req_type == "property":
        bn = req.get("baseName") or {}
        return bn.get("value", req.get("key", req_type))
    return req.get("key", req_type)


def get_ifc_info(ifc_path: str) -> Dict:
    """Return basic metadata about an IFC file."""
    if not IFC_AVAILABLE:
        return {"error": "ifcopenshell not installed"}
    try:
        ifc_file = ifcopenshell.open(ifc_path)
        schema = ifc_file.schema
        # Count all physical elements (rough estimate)
        count = len(list(ifc_file.by_type("IfcProduct")))
        return {"ifc_schema": schema, "element_count": count}
    except Exception as e:
        return {"error": str(e), "ifc_schema": "unknown", "element_count": 0}

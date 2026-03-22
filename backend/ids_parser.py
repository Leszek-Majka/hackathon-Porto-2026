"""IDS XML parser — extracts specifications and requirements from IDS files."""
import xml.etree.ElementTree as ET
import json
from typing import Dict, Any, List, Optional

IDS_NS = "http://standards.buildingsmart.org/IDS"
XS_NS = "http://www.w3.org/2001/XMLSchema"


def _ns(tag: str) -> str:
    return f"{{{IDS_NS}}}{tag}"


def _get_simple_value(element: Optional[ET.Element], tag: str) -> Optional[str]:
    if element is None:
        return None
    child = element.find(f"{_ns(tag)}/{_ns('simpleValue')}")
    if child is not None:
        return child.text
    # Also try without namespace prefix for robustness
    child = element.find(f".//{_ns('simpleValue')}")
    if child is not None:
        return child.text
    return None


def _parse_value_constraint(element: Optional[ET.Element]) -> Optional[Dict]:
    """Parse a value constraint element (simpleValue, restriction, etc)."""
    if element is None:
        return None
    # simpleValue
    sv = element.find(f"{_ns('simpleValue')}")
    if sv is not None:
        return {"type": "simpleValue", "value": sv.text}
    # xs:restriction
    restriction = element.find(f"{{{XS_NS}}}restriction")
    if restriction is not None:
        enumerations = [e.get("value") for e in restriction.findall(f"{{{XS_NS}}}enumeration")]
        if enumerations:
            return {"type": "enumeration", "values": enumerations}
        pattern = restriction.find(f"{{{XS_NS}}}pattern")
        if pattern is not None:
            return {"type": "pattern", "value": pattern.get("value")}
        return {"type": "restriction", "base": restriction.get("base")}
    return None


def _parse_entity(applicability: ET.Element) -> Optional[Dict]:
    entity_el = applicability.find(_ns("entity"))
    if entity_el is None:
        return None
    name_el = entity_el.find(_ns("name"))
    predef_el = entity_el.find(_ns("predefinedType"))
    return {
        "name": _parse_value_constraint(name_el),
        "predefinedType": _parse_value_constraint(predef_el),
    }


def _parse_applicability(applicability: ET.Element) -> Dict:
    result: Dict[str, Any] = {}
    entity = _parse_entity(applicability)
    if entity:
        result["entity"] = entity

    part_of = applicability.find(_ns("partOf"))
    if part_of is not None:
        relation = part_of.get("relation")
        entity_el = part_of.find(_ns("entity"))
        result["partOf"] = {
            "relation": relation,
            "entity": _parse_entity(part_of) if entity_el is None else _parse_entity(part_of),
        }

    # property filters
    props = []
    for prop_el in applicability.findall(_ns("property")):
        ps_el = prop_el.find(_ns("propertySet"))
        bn_el = prop_el.find(_ns("baseName"))
        props.append({
            "propertySet": _parse_value_constraint(ps_el),
            "baseName": _parse_value_constraint(bn_el),
        })
    if props:
        result["properties"] = props

    return result


def _build_req_key(req_type: str, element: ET.Element, index: int) -> str:
    """Build a stable string key for a requirement element."""
    if req_type == "attribute":
        name_el = element.find(_ns("name"))
        sv = name_el.find(_ns("simpleValue")) if name_el is not None else None
        label = sv.text if sv is not None else str(index)
        return f"attribute:{label}"
    elif req_type == "property":
        ps_el = element.find(_ns("propertySet"))
        bn_el = element.find(_ns("baseName"))
        ps_sv = ps_el.find(_ns("simpleValue")) if ps_el is not None else None
        bn_sv = bn_el.find(_ns("simpleValue")) if bn_el is not None else None
        ps = ps_sv.text if ps_sv is not None else "?"
        bn = bn_sv.text if bn_sv is not None else str(index)
        return f"property:{ps}.{bn}"
    elif req_type == "material":
        return f"material:{index}"
    elif req_type == "classification":
        sys_el = element.find(_ns("system"))
        sv = sys_el.find(_ns("simpleValue")) if sys_el is not None else None
        label = sv.text if sv is not None else str(index)
        return f"classification:{label}"
    elif req_type == "partOf":
        relation = element.get("relation", str(index))
        return f"partOf:{relation}"
    return f"{req_type}:{index}"


def _parse_requirement(req_type: str, element: ET.Element, index: int) -> Dict:
    min_occurs_raw = element.get("minOccurs", "1")
    cardinality = element.get("cardinality", "")

    # Determine base optionality: 0 = optional, 1 = required
    # Also check cardinality attribute as fallback
    if min_occurs_raw == "0" or cardinality == "optional":
        base_status = "optional"
    else:
        base_status = "required"

    req: Dict[str, Any] = {
        "key": _build_req_key(req_type, element, index),
        "type": req_type,
        "minOccurs": min_occurs_raw,
        "cardinality": cardinality,
        "baseStatus": base_status,
        "instructions": element.get("instructions", ""),
    }

    if req_type == "attribute":
        name_el = element.find(_ns("name"))
        val_el = element.find(_ns("value"))
        req["name"] = _parse_value_constraint(name_el)
        req["value"] = _parse_value_constraint(val_el)

    elif req_type == "property":
        ps_el = element.find(_ns("propertySet"))
        bn_el = element.find(_ns("baseName"))
        val_el = element.find(_ns("value"))
        dt_el = element.find(_ns("dataType"))
        req["propertySet"] = _parse_value_constraint(ps_el)
        req["baseName"] = _parse_value_constraint(bn_el)
        req["value"] = _parse_value_constraint(val_el)
        req["dataType"] = _parse_value_constraint(dt_el)

    elif req_type == "material":
        val_el = element.find(_ns("value"))
        req["value"] = _parse_value_constraint(val_el)

    elif req_type == "classification":
        val_el = element.find(_ns("value"))
        sys_el = element.find(_ns("system"))
        req["value"] = _parse_value_constraint(val_el)
        req["system"] = _parse_value_constraint(sys_el)

    elif req_type == "partOf":
        relation = element.get("relation")
        entity_el = element.find(_ns("entity"))
        req["relation"] = relation
        if entity_el is not None:
            req["entity"] = _parse_entity(element)

    return req


REQ_TYPES = ["attribute", "property", "material", "classification", "partOf"]


def parse_ids(xml_content: str) -> Dict[str, Any]:
    """Parse IDS XML string and return structured dict."""
    root = ET.fromstring(xml_content)

    # Parse <info>
    info_el = root.find(_ns("info"))
    info: Dict[str, Any] = {}
    if info_el is not None:
        for tag in ["title", "copyright", "version", "description", "author", "date", "purpose", "milestone"]:
            el = info_el.find(_ns(tag))
            info[tag] = el.text if el is not None else None

    # Parse <specifications>
    specs_el = root.find(_ns("specifications"))
    specifications: List[Dict] = []

    if specs_el is not None:
        for spec_idx, spec_el in enumerate(specs_el.findall(_ns("specification"))):
            spec_name = spec_el.get("name", f"Specification {spec_idx + 1}")
            spec_id = f"spec_{spec_idx}_{spec_name.replace(' ', '_')}"
            ifc_version = spec_el.get("ifcVersion", "")
            description = spec_el.get("description", "")
            instructions = spec_el.get("instructions", "")

            # Parse applicability
            applicability_el = spec_el.find(_ns("applicability"))
            applicability = _parse_applicability(applicability_el) if applicability_el is not None else {}

            # Parse requirements
            requirements: List[Dict] = []
            req_el = spec_el.find(_ns("requirements"))
            if req_el is not None:
                req_counter: Dict[str, int] = {}
                for child in req_el:
                    # Strip namespace to get local tag
                    tag = child.tag
                    if tag.startswith("{"):
                        tag = tag.split("}", 1)[1]
                    if tag in REQ_TYPES:
                        idx = req_counter.get(tag, 0)
                        req_counter[tag] = idx + 1
                        requirements.append(_parse_requirement(tag, child, idx))

            specifications.append({
                "id": spec_id,
                "name": spec_name,
                "ifcVersion": ifc_version,
                "description": description,
                "instructions": instructions,
                "applicability": applicability,
                "requirements": requirements,
            })

    return {
        "info": info,
        "specifications": specifications,
    }


def parse_ids_to_json(xml_content: str) -> str:
    return json.dumps(parse_ids(xml_content), ensure_ascii=False, indent=2)

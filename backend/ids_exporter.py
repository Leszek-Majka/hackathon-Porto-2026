"""IDS XML exporter — generates phase-specific IDS XML from stored data."""
import xml.etree.ElementTree as ET
import json
import re
from datetime import date
from typing import Dict, Any, List, Optional, Tuple

IDS_NS = "http://standards.buildingsmart.org/IDS"
XS_NS = "http://www.w3.org/2001/XMLSchema"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"

ET.register_namespace("", IDS_NS)
ET.register_namespace("xs", XS_NS)
ET.register_namespace("xsi", XSI_NS)


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


def _export_phase_ids(
    raw_xml: str,
    parsed_data: Dict[str, Any],
    phase_name: str,
    matrix: Dict[str, Dict[str, str]],  # {spec_id: {req_key: status}}
) -> str:
    """
    Generate a phase-specific IDS XML string.
    matrix maps spec_id -> requirement_key -> status (required|optional|excluded)
    """
    # Parse the original XML to preserve structure
    root = ET.fromstring(raw_xml)
    ns = IDS_NS

    def qtag(tag):
        return f"{{{ns}}}{tag}"

    # Update <info> block
    info_el = root.find(qtag("info"))
    if info_el is not None:
        title_el = info_el.find(qtag("title"))
        if title_el is not None:
            title_el.text = f"{title_el.text or ''} — {phase_name}"
        else:
            title_el = ET.SubElement(info_el, qtag("title"))
            title_el.text = phase_name

        date_el = info_el.find(qtag("date"))
        if date_el is not None:
            date_el.text = date.today().isoformat()
        else:
            date_el = ET.SubElement(info_el, qtag("date"))
            date_el.text = date.today().isoformat()

        purpose_el = info_el.find(qtag("purpose"))
        if purpose_el is not None:
            purpose_el.text = f"Phase: {phase_name}"
        else:
            purpose_el = ET.SubElement(info_el, qtag("purpose"))
            purpose_el.text = f"Phase: {phase_name}"

    # Process specifications
    specs_el = root.find(qtag("specifications"))
    if specs_el is None:
        return ET.tostring(root, encoding="unicode", xml_declaration=False)

    REQ_TYPES = {"attribute", "property", "material", "classification", "partOf"}

    for spec_idx, spec_el in enumerate(list(specs_el.findall(qtag("specification")))):
        spec_name = spec_el.get("name", f"Specification {spec_idx}")
        spec_id = f"spec_{spec_idx}_{spec_name.replace(' ', '_')}"
        spec_matrix = matrix.get(spec_id, {})

        req_el = spec_el.find(qtag("requirements"))
        if req_el is None:
            continue

        # Get parsed requirements to match keys
        parsed_specs = parsed_data.get("specifications", [])
        parsed_spec = next((s for s in parsed_specs if s["id"] == spec_id), None)
        parsed_reqs = parsed_spec.get("requirements", []) if parsed_spec else []

        req_type_counters: Dict[str, int] = {}
        children_to_remove = []

        for child in list(req_el):
            tag = child.tag
            if tag.startswith("{"):
                tag = tag.split("}", 1)[1]
            if tag not in REQ_TYPES:
                continue

            idx = req_type_counters.get(tag, 0)
            req_type_counters[tag] = idx + 1

            # Find matching parsed requirement by position
            matching_parsed = None
            pos_counter: Dict[str, int] = {}
            for pr in parsed_reqs:
                pt = pr["type"]
                pc = pos_counter.get(pt, 0)
                pos_counter[pt] = pc + 1
                if pt == tag and pc == idx:
                    matching_parsed = pr
                    break

            if matching_parsed is None:
                continue

            req_key = matching_parsed["key"]
            status = spec_matrix.get(req_key, matching_parsed.get("baseStatus", "required"))

            if status == "excluded":
                children_to_remove.append(child)
            elif status == "optional":
                child.set("minOccurs", "0")
                child.set("cardinality", "optional")
            else:  # required
                child.set("minOccurs", "1")
                child.set("cardinality", "required")

        for child in children_to_remove:
            req_el.remove(child)

    xml_str = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_str}'


def export_phase(
    raw_xml: str,
    parsed_json: str,
    phase_name: str,
    matrix_entries: List[Any],  # list of PhaseMatrix ORM objects or dicts
    phase_id: int,
    lang: str = "en",
    translations: Optional[Dict] = None,  # {entity_type: {entity_id: {field: {lang: value}}}}
) -> str:
    parsed_data = json.loads(parsed_json)

    # Build matrix dict for this phase
    matrix: Dict[str, Dict[str, str]] = {}
    for entry in matrix_entries:
        if hasattr(entry, "phase_id"):
            if entry.phase_id != phase_id:
                continue
            spec_id = entry.spec_id
            req_key = entry.requirement_key
            status = entry.status
        else:
            if entry.get("phase_id") != phase_id:
                continue
            spec_id = entry["spec_id"]
            req_key = entry["requirement_key"]
            status = entry["status"]

        if spec_id not in matrix:
            matrix[spec_id] = {}
        matrix[spec_id][req_key] = status

    xml_str = _export_phase_ids(raw_xml, parsed_data, phase_name, matrix)

    # Apply translations if non-English
    if lang != "en" and translations:
        xml_str = _apply_translations(xml_str, translations, lang)

    return xml_str


def _apply_translations(xml_str: str, translations: Dict, lang: str) -> str:
    """Apply language-specific translations to spec/requirement text nodes."""
    try:
        root = ET.fromstring(xml_str.split("\n", 1)[-1])  # skip xml declaration
    except Exception:
        return xml_str

    ns = IDS_NS

    def qtag(tag):
        return f"{{{ns}}}{tag}"

    specs_el = root.find(qtag("specifications"))
    if not specs_el:
        return xml_str

    spec_translations = translations.get("spec", {})

    for spec_idx, spec_el in enumerate(specs_el.findall(qtag("specification"))):
        spec_name = spec_el.get("name", f"Specification {spec_idx}")
        spec_id = f"spec_{spec_idx}_{spec_name.replace(' ', '_')}"
        spec_t = spec_translations.get(spec_id, {})

        for field in ["name", "description", "instructions"]:
            translated = spec_t.get(field, {}).get(lang)
            if translated:
                if field == "name":
                    spec_el.set("name", translated)
                elif field in ("description", "instructions"):
                    spec_el.set(field, translated)

    xml_out = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_out}'

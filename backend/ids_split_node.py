"""
IDS Split Node — Filter IDS files by specification, applicability, or requirement.

Accepts an IDS file path and a list of filter strings (entity types, spec names,
property set names, property names, material values, etc.), and outputs a valid
filtered IDS file retaining only the matched specifications and requirements.
"""
import sys
import json
import copy
from typing import List, Dict, Any, Optional, Set

try:
    from ifctester import ids
    from ifctester.facet import Restriction
except ImportError:
    from ifcopenshell import ids
    from ifcopenshell.ids import Restriction


class IDSSplitNode:
    """
    Function Node for splitting/filtering IDS files.

    Accepts an IDS file and a list of filter strings, returns a valid
    IDS XML containing only the matched specifications and requirements.

    Filter strings are matched in two phases:
      Phase 1 (spec selection): strings matching spec.name or entity type
      Phase 2 (requirement filtering): remaining strings matched against
              propertySet, baseName, attribute name, material value
    """

    def inspect(self, ids_path: str) -> List[Dict[str, Any]]:
        """Return structured summary of all specs and facets in an IDS file."""
        my_ids = ids.open(ids_path)
        result = []
        for si, spec in enumerate(my_ids.specifications):
            applicability_info = []
            for fi, facet in enumerate(spec.applicability):
                applicability_info.append(self._describe_facet(fi, facet))

            requirements_info = []
            for fi, facet in enumerate(spec.requirements):
                requirements_info.append(self._describe_facet(fi, facet))

            result.append({
                "spec_index": si,
                "spec_name": spec.name,
                "entity": self._get_entity_names(spec),
                "applicability": applicability_info,
                "requirements": requirements_info,
            })
        return result

    def split(self, ids_path: str, filters: List[str]) -> str:
        source = ids.open(ids_path)
        filters_lower = [f.lower() for f in filters]

        spec_selectors: Set[int] = set()
        used_filter_indices: Set[int] = set()

        for fi, fstr in enumerate(filters_lower):
            for si, spec in enumerate(source.specifications):
                if self._matches_spec(spec, fstr):
                    spec_selectors.add(si)
                    used_filter_indices.add(fi)

        facet_filters = [
            filters_lower[i] for i in range(len(filters_lower))
            if i not in used_filter_indices
        ]

        if not spec_selectors:
            raise ValueError(
                f"No specifications match filters: {filters}. "
                f"Available specs: {[s.name for s in source.specifications]}"
            )

        new_ids = ids.Ids()
        new_ids.info = source.info.copy()

        for si in sorted(spec_selectors):
            spec = copy.deepcopy(source.specifications[si])
            if facet_filters:
                filtered_reqs = [
                    req for req in spec.requirements
                    if self._requirement_matches_any(req, facet_filters)
                ]
                spec.requirements = filtered_reqs
            new_ids.specifications.append(spec)

        return new_ids.to_string()

    def save(self, xml_string: str, output_path: str) -> None:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(xml_string)

    def preview(self, ids_path: str, filters: List[str]) -> Dict[str, Any]:
        """
        Dry-run split — returns a preview of what would be matched
        without raising on empty results.
        Returns dict with matched spec names and their surviving requirement keys.
        """
        try:
            xml = self.split(ids_path, filters)
            result_ids = ids.open(xml)
            preview = []
            for spec in result_ids.specifications:
                reqs = []
                for fi, req in enumerate(spec.requirements):
                    d = self._describe_facet(fi, req)
                    reqs.append(d)
                preview.append({
                    "spec_name": spec.name,
                    "surviving_requirements": reqs,
                })
            return {"matched": True, "specs": preview, "error": None}
        except ValueError as e:
            return {"matched": False, "specs": [], "error": str(e)}

    @staticmethod
    def _matches_spec(spec, filter_str: str) -> bool:
        if spec.name and spec.name.lower() == filter_str:
            return True
        for facet in spec.applicability:
            if type(facet).__name__ == "Entity":
                entity_names = IDSSplitNode._extract_entity_names(facet)
                if any(n.lower() == filter_str for n in entity_names):
                    return True
        return False

    @staticmethod
    def _requirement_matches_any(req, facet_filters: List[str]) -> bool:
        ft = type(req).__name__
        searchable_values: List[str] = []

        if ft == "Property":
            if req.propertySet:
                searchable_values.append(str(req.propertySet))
            if req.baseName:
                searchable_values.append(str(req.baseName))
        elif ft == "Attribute":
            if req.name:
                searchable_values.append(str(req.name))
        elif ft == "Material":
            searchable_values.append("material")
            val = getattr(req, "value", None)
            if val is not None:
                searchable_values.append(str(val))
        elif ft == "Classification":
            searchable_values.append("classification")
            for attr in ["system", "value"]:
                val = getattr(req, attr, None)
                if val is not None:
                    searchable_values.append(str(val))
        elif ft == "PartOf":
            searchable_values.append("partof")
            for attr in ["relation", "name"]:
                val = getattr(req, attr, None)
                if val is not None:
                    searchable_values.append(str(val))

        searchable_lower = [v.lower() for v in searchable_values]
        return any(ff in searchable_lower for ff in facet_filters)

    @staticmethod
    def _extract_entity_names(facet) -> List[str]:
        name = facet.name
        if isinstance(name, Restriction):
            vals = name.options.get("enumeration", [])
            if vals:
                return [v.upper() for v in vals]
        elif isinstance(name, dict):
            vals = name.get("enumeration", [])
            if vals:
                return [v.upper() for v in vals]
        if name:
            return [str(name).upper()]
        return []

    @staticmethod
    def _get_entity_names(spec) -> str:
        for facet in spec.applicability:
            if type(facet).__name__ == "Entity":
                names = IDSSplitNode._extract_entity_names(facet)
                return "/".join(names) if names else "UNKNOWN"
        return "UNKNOWN"

    @staticmethod
    def _describe_facet(index: int, facet) -> Dict[str, Any]:
        ft = type(facet).__name__
        info: Dict[str, Any] = {"index": index, "type": ft}

        if ft == "Entity":
            names = IDSSplitNode._extract_entity_names(facet)
            info["name"] = "/".join(names) if names else "UNKNOWN"
            pred = getattr(facet, "predefinedType", None)
            if pred:
                info["predefinedType"] = str(pred)
        elif ft == "Property":
            if facet.propertySet:
                info["propertySet"] = str(facet.propertySet)
            if facet.baseName:
                info["baseName"] = str(facet.baseName)
            val = getattr(facet, "value", None)
            if isinstance(val, Restriction):
                info["constraint"] = ",".join(f"{k}={v}" for k, v in val.options.items())
            elif val is not None:
                info["value"] = str(val)
        elif ft == "Attribute":
            if facet.name:
                info["name"] = str(facet.name)
            val = getattr(facet, "value", None)
            if isinstance(val, Restriction):
                info["constraint"] = ",".join(f"{k}={v}" for k, v in val.options.items())
            elif val is not None:
                info["value"] = str(val)
        elif ft == "Material":
            val = getattr(facet, "value", None)
            if val is not None:
                info["value"] = str(val)
        elif ft == "Classification":
            for attr in ["system", "value"]:
                val = getattr(facet, attr, None)
                if val is not None:
                    info[attr] = str(val)
        elif ft == "PartOf":
            for attr in ["relation", "name"]:
                val = getattr(facet, attr, None)
                if val is not None:
                    info[attr] = str(val)

        return info

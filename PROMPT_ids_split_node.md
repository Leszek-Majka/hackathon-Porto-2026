# IDS Split Node — Integration Prompt

Paste this prompt into Claude Code in VS Code inside the existing `ids-phase-editor` project.

---

## PROMPT

I have an existing full-stack project (`ids-phase-editor`) with a FastAPI backend and React + TypeScript frontend. I want to integrate a new feature called **Smart Auto-Fill** based on the `IDSSplitNode` class below.

---

### THE CLASS TO INTEGRATE

Copy the following class verbatim into `backend/ids_split_node.py`. Do not modify its logic — only fix the import if `ifctester` is not available (fall back to `ifcopenshell.ids` which exposes the same API):

```python
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
from ifctester import ids
from ifctester.facet import Restriction


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
```

---

### WHAT TO BUILD

#### Overview

Add a **Smart Auto-Fill** feature to the Phase Matrix Editor. Instead of manually clicking every REQ/OPT/— cell, the user types filter keywords (e.g. `Pset_WallCommon`, `IfcWall`, `LoadBearing`) and the system automatically sets the status of all matching requirements across the selected phase.

The `IDSSplitNode.split()` method tells us *which requirements survive* a given set of filters. We use this as a signal: requirements that survive → set to `required` in the phase matrix. Requirements that don't survive → keep their current status (don't overwrite).

---

### BACKEND CHANGES

#### 1. New file: `backend/ids_split_node.py`
Copy the full class above. No changes to logic.

Add a small helper method to the class (append after `save()`):

```python
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
```

#### 2. New router: `backend/routers/autofill.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from database import get_db
from models import Project, IdsFile, Phase, PhaseMatrix
from ids_split_node import IDSSplitNode
import json, tempfile, os

router = APIRouter(prefix="/api/projects/{project_id}", tags=["autofill"])
node = IDSSplitNode()


class AutoFillRequest(BaseModel):
    phase_id: int
    filters: List[str]
    # status to apply to matched requirements: "required" or "optional"
    apply_status: str = "required"
    # if True, only preview — do not write to DB
    dry_run: bool = False


class AutoFillResponse(BaseModel):
    dry_run: bool
    matched_specs: int
    matched_requirements: int
    updated_cells: int
    preview: list
    error: str | None = None


@router.post("/matrix/autofill", response_model=AutoFillResponse)
def autofill_matrix(project_id: int, body: AutoFillRequest, db: Session = Depends(get_db)):
    # Load IDS file for this project
    ids_file = db.query(IdsFile).filter(IdsFile.project_id == project_id).first()
    if not ids_file:
        raise HTTPException(404, "No IDS file uploaded for this project")

    phase = db.query(Phase).filter(Phase.id == body.phase_id, Phase.project_id == project_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")

    # Write raw XML to a temp file (IDSSplitNode.split() needs a file path)
    with tempfile.NamedTemporaryFile(suffix=".ids", delete=False, mode="w", encoding="utf-8") as tmp:
        tmp.write(ids_file.raw_xml)
        tmp_path = tmp.name

    try:
        preview_result = node.preview(tmp_path, body.filters)
    finally:
        os.unlink(tmp_path)

    if not preview_result["matched"]:
        return AutoFillResponse(
            dry_run=body.dry_run,
            matched_specs=0,
            matched_requirements=0,
            updated_cells=0,
            preview=[],
            error=preview_result["error"]
        )

    # Parse the full IDS structure to build requirement key mapping
    # requirement key format matches what ids_parser.py generates:
    # "attr_{i}_{name}", "prop_{i}_{name}", "mat_{i}", "cls_{i}", "part_{i}"
    parsed = json.loads(ids_file.parsed_json)
    
    # Build a lookup: spec_name → list of all requirement keys
    spec_req_map = {}
    for spec in parsed.get("specs", []):
        spec_req_map[spec["name"]] = {
            req["key"]: req for req in spec.get("requirements", [])
        }

    matched_specs = 0
    matched_requirements = 0
    updated_cells = 0

    for preview_spec in preview_result["specs"]:
        spec_name = preview_spec["spec_name"]
        if spec_name not in spec_req_map:
            continue

        matched_specs += 1
        all_req_keys = list(spec_req_map[spec_name].keys())

        # Find the spec_id from parsed data
        spec_id = None
        for spec in parsed.get("specs", []):
            if spec["name"] == spec_name:
                spec_id = spec["id"]
                break

        if not spec_id:
            continue

        # Determine which requirement keys survived the filter
        surviving_req_names = set()
        for sr in preview_spec["surviving_requirements"]:
            # Match by type + name/baseName/propertySet
            for key, req in spec_req_map[spec_name].items():
                if _req_matches_describe(req, sr):
                    surviving_req_names.add(key)

        matched_requirements += len(surviving_req_names)

        if not body.dry_run:
            for req_key in surviving_req_names:
                # Upsert into phase_matrix
                existing = db.query(PhaseMatrix).filter_by(
                    project_id=project_id,
                    spec_id=spec_id,
                    requirement_key=req_key,
                    phase_id=body.phase_id
                ).first()
                if existing:
                    existing.status = body.apply_status
                else:
                    db.add(PhaseMatrix(
                        project_id=project_id,
                        spec_id=spec_id,
                        requirement_key=req_key,
                        phase_id=body.phase_id,
                        status=body.apply_status
                    ))
                updated_cells += 1
            db.commit()

    return AutoFillResponse(
        dry_run=body.dry_run,
        matched_specs=matched_specs,
        matched_requirements=matched_requirements,
        updated_cells=updated_cells,
        preview=preview_result["specs"],
    )


def _req_matches_describe(req: dict, described: dict) -> bool:
    """Match a stored requirement dict against a _describe_facet output."""
    req_type_map = {
        "attribute": "Attribute",
        "property": "Property",
        "material": "Material",
        "classification": "Classification",
        "partOf": "PartOf",
    }
    if req_type_map.get(req.get("type")) != described.get("type"):
        return False
    if req.get("type") == "property":
        return req.get("name") == described.get("baseName")
    if req.get("type") == "attribute":
        return req.get("name") == described.get("name")
    return True  # material, classification, partOf — match by type
```

#### 3. Register the router in `backend/main.py`

```python
from routers import autofill
app.include_router(autofill.router)
```

#### 4. Add `ifctester` to `requirements.txt` if not already present

```
ifctester
```

---

### FRONTEND CHANGES

#### 1. New component: `frontend/src/components/AutoFillPanel.tsx`

This panel appears inside the Phase Matrix tab, above the matrix table. It lets the user type filter keywords, preview matches, and apply them.

Props:
```typescript
interface AutoFillPanelProps {
  projectId: number
  phaseId: number
  phaseName: string
  onApplied: () => void   // callback to refresh the matrix after apply
}
```

UI layout:
- Collapsible section with header "Smart Auto-Fill" + a wand icon (✦)
- When expanded:
  - Short description: "Type keywords to automatically set requirements as Required or Optional for this phase."
  - Tag input: user types a keyword and presses Enter or comma to add it as a chip. Chips are removable with ×. Placeholder: `"e.g. IfcWall, Pset_WallCommon, LoadBearing"`
  - Status selector: two radio buttons — "Set matched as Required" (default) | "Set matched as Optional"
  - Two buttons side by side: "Preview" (outline) and "Apply" (primary green)
  - Preview results area (shown after clicking Preview):
    - If no match: amber warning "No specifications matched these filters."
    - If match: green summary "X specifications · Y requirements will be updated" + expandable list of matched spec names with their surviving requirements listed as monospace chips
  - After Apply: success toast "X cells updated in [Phase Name]" + matrix refreshes

#### 2. New API function: `frontend/src/api/client.ts`

Add to the existing API client:

```typescript
export async function autoFillMatrix(
  projectId: number,
  phaseId: number,
  filters: string[],
  applyStatus: 'required' | 'optional',
  dryRun: boolean
): Promise<AutoFillResponse> {
  const res = await fetch(`/api/projects/${projectId}/matrix/autofill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase_id: phaseId,
      filters,
      apply_status: applyStatus,
      dry_run: dryRun,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

Add the response type to `frontend/src/types/project.ts`:

```typescript
export interface AutoFillResponse {
  dry_run: boolean
  matched_specs: number
  matched_requirements: number
  updated_cells: number
  preview: AutoFillPreviewSpec[]
  error: string | null
}

export interface AutoFillPreviewSpec {
  spec_name: string
  surviving_requirements: AutoFillPreviewReq[]
}

export interface AutoFillPreviewReq {
  type: string
  name?: string
  baseName?: string
  propertySet?: string
  value?: string
}
```

#### 3. Mount `AutoFillPanel` in `SpecMatrix.tsx`

At the top of the phase matrix view (above the table, below the spec header), render one `AutoFillPanel` per active phase column — or a single global one with a phase dropdown if that fits the layout better. Use a single global panel with a phase selector dropdown if there are more than 2 phases (cleaner UX).

---

### BEHAVIOUR DETAILS

**Filter logic (inherit from IDSSplitNode — do not re-implement):**
- Filters that match a spec name or entity type → select that spec (Phase 1)
- Remaining filters → filter requirements within selected specs (Phase 2)
- Matching is case-insensitive
- Example: `["IfcWall", "LoadBearing"]` selects the Walls spec and keeps only the LoadBearing property requirement

**Apply behaviour:**
- Only overwrites cells for matched requirements — does NOT reset unmatched cells to `excluded`
- If a cell is already `required` and filter says `required` → no change (idempotent)
- Can be run multiple times with different filters to build up the matrix incrementally

**Preview is mandatory before Apply:**
- "Apply" button is disabled until the user has run "Preview" at least once with the current set of filters
- If filters change after Preview, "Apply" becomes disabled again until Preview is re-run

---

### VISUAL DESIGN

Match the existing project style:
- Collapsed state: single row with "✦ Smart Auto-Fill" label (monospace, small) + chevron
- Expanded: light green tinted background (`#F0F7F0`), subtle border, rounded corners
- Tag chips: small, monospace, removable, green border
- Preview results: animated fade-in, green for match summary, red/amber for no match
- "Apply" button: same green primary style as existing buttons

---

### WHAT NOT TO CHANGE

- Do not modify `IDSSplitNode` class logic
- Do not change the existing matrix save/load endpoints
- Do not change the existing IDS parser — `IDSSplitNode` is additive, not a replacement
- Do not add new DB tables — use the existing `phase_matrix` table

---

### IMPLEMENTATION ORDER

1. Copy `IDSSplitNode` class to `backend/ids_split_node.py`, add `preview()` method
2. Create `backend/routers/autofill.py` with the endpoint above
3. Register router in `backend/main.py`
4. Add `ifctester` to `requirements.txt` and install
5. Add `AutoFillResponse` types to `frontend/src/types/project.ts`
6. Add `autoFillMatrix()` to `frontend/src/api/client.ts`
7. Build `frontend/src/components/AutoFillPanel.tsx`
8. Mount `AutoFillPanel` in `SpecMatrix.tsx`
9. Test with a real `.ids` file using filters: spec name, entity type, Pset name, property name, "material"

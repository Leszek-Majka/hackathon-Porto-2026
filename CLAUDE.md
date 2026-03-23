# IDS Phase Editor — Claude Code Build Prompt (Extended)

Paste this prompt into Claude Code in VS Code to scaffold the full local application.

---

## PROMPT

Build a full-stack web application called **IDS Phase Editor** — a tool for managing and splitting IFC Information Delivery Specification (IDS) files by project phase, validating IFC models against those requirements, and reporting on information maturity.

The IDS format is an open buildingSMART standard: https://github.com/buildingSMART/IDS

---

### STACK

- **Backend**: Python + FastAPI + SQLite (via SQLAlchemy + Alembic)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **IFC parsing**: `ifcopenshell` (Python library)
- **PDF generation**: `reportlab`
- **No Docker required** — must run locally with simple CLI commands

---

### FEATURES TO BUILD

#### 1. File Upload & IDS Parsing
- Upload `.ids` (XML) files via drag-and-drop or file picker
- Parse IDS XML and extract:
  - `<info>` block: title, author, date, version
  - `<specifications>`: each spec's name, ifcVersion, description
  - Per spec: `<applicability>` (entity, predefinedType, partOf, property filters)
  - Per spec: `<requirements>` — all child elements: `attribute`, `property`, `material`, `classification`, `partOf`
  - For each requirement, read `minOccurs` attribute to determine base optionality (`0` = optional, `1` = required)
- Store the raw XML in the database alongside the parsed structure

#### 2. Project & Phase Management
- A user can create a **Project** (name, description)
- Each project holds one uploaded IDS file
- The user defines custom **Phases** for the project (e.g. "Concept", "Schematic Design", "Construction Documents", "Handover")
- Phases are ordered and can be renamed or deleted

#### 3. Phase Matrix Editor (core feature)
- For each specification in the IDS, show a **matrix table**:
  - Rows = requirements (attributes, properties, materials, etc.)
  - Columns = project phases
  - Each cell = a status selector: `required` | `optional` | `excluded`
- Default value for each cell = inherited from IDS base optionality (required/optional)
- Store the full matrix in the database as structured JSON (per project)
- Auto-save on every cell change (debounced, 500ms)

#### 4. Compare View
- Side-by-side card view showing per phase:
  - How many requirements are required / optional / excluded
  - Breakdown per specification

#### 5. Export
- Export a separate `.ids` XML file for each phase
- The exported file:
  - Sets `minOccurs="1"` for required requirements
  - Sets `minOccurs="0"` for optional requirements
  - Omits (removes) excluded requirements entirely
  - Updates `<info>` block: appends phase name to title, updates date
- Export single phase or all phases as a ZIP archive

#### 6. Project Dashboard
- List all projects with metadata
- Each project shows: IDS title, number of specs, number of phases, last modified
- Open / Delete / Duplicate project

---

### MODULE A — IFC VALIDATION

This module closes the loop: users upload an IFC model and validate it against the IDS requirements for a selected phase.

#### A1. IFC Upload
- Upload `.ifc` file per project (stored at `backend/uploads/{project_id}/model.ifc`)
- Show file name, size, IFC schema version (IFC2X3 / IFC4 / IFC4X3) detected via `ifcopenshell`
- Store upload metadata in DB — cache parsed result as JSON, do not re-parse on every request

#### A2. Validation Engine (backend)
Use `ifcopenshell` to validate the IFC model against the phase-specific IDS matrix.

For each specification in the IDS:
1. Query all IFC elements matching the applicability filter (entity type, predefined type)
2. For each **required** requirement in the selected phase:
   - Check `attribute`: verify the attribute exists and is not None/empty
   - Check `property`: verify the property exists in the specified Pset
   - Check `material`: verify the element has a material assignment
   - Check `classification`: verify the element has a classification reference
3. For each **optional** requirement: check and report but do not count as failure
4. Return structured results: per element, per requirement — pass / fail / not-applicable

Validation result structure:
```json
{
  "phase_id": "...",
  "validated_at": "...",
  "summary": {
    "total_elements": 42,
    "passing_elements": 38,
    "failing_elements": 4,
    "pass_rate": 0.905
  },
  "specs": [
    {
      "spec_id": "spec_0",
      "spec_name": "Load-bearing Walls",
      "elements_checked": 12,
      "elements_passing": 11,
      "failures": [
        {
          "element_id": "#123",
          "element_type": "IfcWall",
          "element_name": "Wall-001",
          "failed_requirements": ["FireRating", "Material"]
        }
      ]
    }
  ]
}
```

Store each validation run in a `validation_runs` table.

#### A3. Validation UI
- Tab "Validate" on the project detail page
- Phase selector dropdown — choose which phase to validate against
- "Run Validation" button — triggers `POST /api/projects/{id}/validate/{phase_id}`
- Show progress indicator during validation (poll status every 2s)
- Results view:
  - Top summary bar: pass rate as large percentage + colored ring chart (use Recharts PieChart)
  - Per-specification accordion: expand to see failing elements
  - Per-element row: GlobalId, Name, Type, list of failed requirements as red badges
  - Passing elements shown as collapsed green summary ("11 elements passed")
- "Re-run" button to re-validate after changes
- Validation history: list of past runs with timestamp and pass rate

#### A4. Validation API routes
```
POST   /api/projects/{id}/upload-ifc           # upload IFC file
GET    /api/projects/{id}/ifc-info             # get IFC metadata
POST   /api/projects/{id}/validate/{phase_id}  # start validation (async, returns job id)
GET    /api/projects/{id}/validations          # list all validation runs
GET    /api/projects/{id}/validations/{run_id} # get full run results + status
DELETE /api/projects/{id}/validations/{run_id} # delete run
```

Run validation in a background thread (`asyncio.to_thread`) and store status as `pending | running | complete | error` in the DB. Frontend polls every 2 seconds until status is `complete`.

---

### MODULE B — INFORMATION MATURITY DASHBOARD

Visual analytics showing how information requirements grow across phases and how well the IFC model meets them.

#### B1. Maturity Chart — Requirements Growth
A stacked bar chart (Recharts) showing per phase:
- Number of `required` requirements (green)
- Number of `optional` requirements (amber)
- Number of `excluded` requirements (gray)

X-axis = project phases (in order), Y-axis = count. Visualises the "information ramp-up" across the project lifecycle.

#### B2. Validation Progress Chart
If validation runs exist, show a line chart:
- X-axis = validation run timestamps
- Y-axis = pass rate (0–100%)
- One line per phase (color-coded to match phase colors)
- Shows whether model compliance is improving over time

#### B3. Specification Heatmap
A grid where:
- Rows = specifications
- Columns = phases
- Cell color = pass rate from the latest validation run for that spec × phase
  - Green = 90–100%, Amber = 60–89%, Red = 0–59%, Gray = not yet validated
- Clicking a cell opens the detailed validation result for that spec/phase

#### B4. Summary Metric Cards
Row of metric cards at the top:
- Total specifications
- Total requirements across all specs
- Phases defined
- Latest overall pass rate (from most recent validation)
- Most problematic specification (most failures in latest run)

#### B5. PDF Report Export
Generate a PDF report containing:
- Cover: project name, date, author, IDS title and version
- Phase overview table (phases × requirement counts — required / optional / excluded)
- Maturity chart embedded as image (render with reportlab drawing primitives)
- Validation results summary table per phase (pass rate, elements checked, failures)
- List of failing elements grouped by specification
- Footer: generation timestamp + report language label

API route: `GET /api/projects/{id}/report/pdf?phase_id=...&lang=en`
(if `phase_id` omitted → include all phases; `lang` defaults to `en`)

Store generated PDFs temporarily in `backend/exports/` — clean up files older than 24h on startup.

#### B6. Dashboard UI
- Top-level tab "Dashboard" on project detail page
- Metric cards row at top
- Two-column layout: maturity chart (left, 60%) + heatmap (right, 40%)
- Validation progress chart below (full width)
- "Export PDF Report" button in top-right corner

---

### MODULE C — MULTILINGUAL SUPPORT

Manage translations of IDS content and export language-specific IDS files.

#### C1. Supported Languages
Support these languages (user can enable/disable per project):
- English (`en`) — always present, the base language, non-removable
- Polish (`pl`)
- German (`de`)
- French (`fr`)
- Spanish (`es`)
- Dutch (`nl`)

Language settings in project settings panel — user picks which languages are active.

#### C2. Translation Management UI
New tab "Translations" on the project detail page.

Layout: left panel = list of specifications (expandable to requirements), right panel = translation editor for the selected item.

Translatable fields per specification: `name`, `description`, `instructions`
Translatable fields per requirement: `label` (human-readable display name for reports)

Translation editor panel (right):
- One row per active language (flag emoji + language name)
- `en` row shows the base IDS value — read-only, used as reference
- Other languages: text input, auto-saved on blur (debounced 800ms)
- Visual indicator: filled dot = translated, empty dot = missing translation
- "Copy from English" button per row for quick scaffolding

#### C3. Translation Storage
```
translations
  id, project_id, entity_type (spec|requirement), entity_id,
  field (name|description|instructions|label), language_code, value, updated_at

project_languages
  id, project_id, language_code, enabled
```

#### C4. Language-specific IDS Export
When exporting an IDS file for a phase, user can select a target language.
The exported XML:
- Sets `<name>`, `<description>`, `<instructions>` elements to translated values for the chosen language
- Falls back to English if translation is missing for any field
- Adds `xml:lang="pl"` (or relevant code) attribute to translated elements
- Updates `<info><title>` to include the phase name (translated if available)

Export UI update: add a "Language" dropdown to each phase export row in the Export panel.

#### C5. Multilingual PDF Report
PDF respects the selected language:
- All static labels and headings in the selected language
- Specification names and descriptions in the selected language (fallback to English)
- Footer shows: "Report language: Polish (pl)"

Implement a static `i18n` dict in `backend/i18n.py` for report static strings:
```python
REPORT_STRINGS = {
  "en": {
    "report_title": "Information Maturity Report",
    "phase": "Phase",
    "required": "Required",
    "optional": "Optional",
    "excluded": "Excluded",
    "pass_rate": "Pass Rate",
    "failing_elements": "Failing Elements",
    "generated_on": "Generated on",
  },
  "pl": {
    "report_title": "Raport dojrzałości informacyjnej",
    "phase": "Etap",
    "required": "Wymagany",
    "optional": "Opcjonalny",
    "excluded": "Wykluczony",
    "pass_rate": "Wskaźnik zgodności",
    "failing_elements": "Elementy niezgodne",
    "generated_on": "Wygenerowano",
  },
  "de": { ... },
  "fr": { ... },
}
```

#### C6. Translation API routes
```
GET    /api/projects/{id}/translations
PUT    /api/projects/{id}/translations           # upsert {entity_type, entity_id, field, language_code, value}
DELETE /api/projects/{id}/translations/{tid}
GET    /api/projects/{id}/languages
PUT    /api/projects/{id}/languages              # [{code, enabled}]
```

---

### UPDATED DATABASE SCHEMA

```
projects
  id, name, description, created_at, updated_at

ids_files
  id, project_id, filename, raw_xml, parsed_json, uploaded_at

ifc_files
  id, project_id, filename, file_path, ifc_schema, element_count, uploaded_at

phases
  id, project_id, name, color, order_index, created_at

phase_matrix
  id, project_id, spec_id, requirement_key, phase_id, status

validation_runs
  id, project_id, phase_id, ifc_file_id, status, run_at, summary_json, results_json

translations
  id, project_id, entity_type, entity_id, field, language_code, value, updated_at

project_languages
  id, project_id, language_code, enabled
```

---

### FRONTEND STRUCTURE

```
src/
  components/
    Layout.tsx
    ProjectList.tsx
    ProjectDetail.tsx            # tabs: Matrix | Validate | Dashboard | Translations | Export
    UploadZone.tsx
    PhaseManager.tsx
    SpecMatrix.tsx
    StatusSelector.tsx
    CompareView.tsx
    ExportPanel.tsx              # updated: language selector per phase
    # Module A
    IFCUpload.tsx
    ValidationRunner.tsx
    ValidationResults.tsx
    ValidationHistory.tsx
    # Module B
    Dashboard.tsx
    MetricCards.tsx
    MaturityChart.tsx            # Recharts BarChart stacked
    ValidationProgressChart.tsx  # Recharts LineChart
    SpecHeatmap.tsx
    # Module C
    TranslationEditor.tsx
    LanguageSelector.tsx
  hooks/
    useProject.ts
    useMatrix.ts
    useValidation.ts
    useDashboard.ts
    useTranslations.ts
  api/
    client.ts
  types/
    ids.ts
    project.ts
    validation.ts
    dashboard.ts
    translations.ts
  App.tsx
  main.tsx
```

---

### BACKEND FILE STRUCTURE

```
backend/
  main.py
  models.py
  schemas.py
  database.py
  ids_parser.py
  ids_exporter.py          # updated: accepts language param
  ifc_validator.py         # NEW: ifcopenshell validation engine
  pdf_reporter.py          # NEW: reportlab PDF generation
  i18n.py                  # NEW: static strings for reports in all languages
  routers/
    projects.py
    phases.py
    matrix.py
    export.py
    validation.py          # NEW
    dashboard.py           # NEW
    translations.py        # NEW
  uploads/                 # IFC file storage (gitignored)
  exports/                 # generated PDFs, temp (gitignored)
  sample_data/
    sample.ids
    sample.ifc             # minimal IFC4 with walls and slabs for testing
  alembic/
  requirements.txt
```

---

### requirements.txt

```
fastapi
uvicorn[standard]
sqlalchemy
alembic
pydantic
python-multipart
lxml
ifcopenshell
reportlab
pillow
python-dateutil
```

---

### VISUAL DESIGN

- Clean, professional, minimal — appropriate for BIM/AEC industry users
- Light mode default, dark mode support via Tailwind
- Color-coded phases (each phase gets a distinct color from a preset palette)
- Status badges: `required` → green, `optional` → amber, `excluded` → gray
- Validation colors: pass → green `#2E7D32`, fail → red `#B71C1C`, warning → amber `#E65100`, not validated → gray
- Monospace font for IDS attribute/property names (`JetBrains Mono` or `IBM Plex Mono`)
- Serif display font for headings (`Lora` or `Playfair Display`)
- Responsive layout — sidebar collapses on narrow screens
- All Recharts use the phase color palette

---

### IFC VALIDATION — KEY NOTES

- Use `ifcopenshell.open(file_path)` to open the IFC file
- Get elements by type: `ifc_file.by_type("IfcWall")`
- Check attribute: `getattr(element, attr_name, None)`
- Check property in Pset:
  ```python
  for rel in element.IsDefinedBy:
      if rel.is_a("IfcRelDefinesByProperties"):
          pset = rel.RelatingPropertyDefinition
          if pset.Name == pset_name:
              for prop in pset.HasProperties:
                  if prop.Name == prop_name:
                      return prop.NominalValue
  ```
- Check material: `element.HasAssociations` → filter `IfcRelAssociatesMaterial`
- Check classification: `element.HasAssociations` → filter `IfcRelAssociatesClassification`
- Run validation in `asyncio.to_thread` — IFC parsing can be slow for large files
- Set max upload size to 500MB in FastAPI

---

### PROJECT SETUP COMMANDS

Generate a `README.md` with these exact setup steps:

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → opens at http://localhost:5173
```

---

### IMPORTANT NOTES

1. **All UI text must be in English** (except translated content inside the Translations module)
2. The app must work fully offline — no external API calls at runtime, no translation services
3. SQLite database file at `backend/ids_editor.db`
4. CORS configured for `localhost:5173` → `localhost:8000`
5. Validation runs are async: store `status: pending|running|complete|error` in DB, frontend polls every 2s
6. IFC files can be 100MB+ — set max upload size to 500MB
7. Export filenames: `{project}_{phase}_{lang}.ids` (slugified), ZIP: `{project}_all-phases_{date}.zip`
8. PDF filename: `{project}_maturity-report_{date}.pdf`
9. Clean up export temp files older than 24h on app startup
10. Include a minimal sample `.ifc` (IFC4, a few walls + slabs + windows) in `backend/sample_data/`

---

### IMPLEMENTATION ORDER

1. Scaffold full directory structure and all empty files with correct imports
2. Backend: models → database → schemas → Alembic migration
3. Backend: ids_parser → core routers (projects, phases, matrix, export)
4. Backend: ifc_validator → validation router (Module A)
5. Backend: pdf_reporter + i18n → dashboard router (Module B)
6. Backend: translations router (Module C) + update ids_exporter for language param
7. Frontend: Layout + routing + typed API client
8. Frontend: Core features (upload, matrix editor, compare, export)
9. Frontend: Module A — IFC upload + validation UI + polling
10. Frontend: Module B — Dashboard (Recharts charts + heatmap + PDF export button)
11. Frontend: Module C — Translation editor + language selector + language-aware export

Start by scaffolding the full directory structure, then proceed in the order above.

---

# Claude Code — IDS Precheck LCA Dashboard Extension

## CONTEXT

This project is the IDS Phase Editor — a FastAPI + React + TypeScript + Vite + Tailwind + Recharts
app for managing IDS files split by project phase. The existing stack is already running.

The codebase has:
- `backend/` — FastAPI, SQLAlchemy, SQLite, Alembic
- `frontend/src/` — React 18, TypeScript, Vite, Tailwind, Recharts
- `frontend/src/components/SpecMatrix.tsx` — the phase × requirement matrix
- Existing Phase management with order_index, name, color

DO NOT break any existing functionality. Add new components alongside what exists.

---

## TASK — Add LCA Carbon Dashboard with RIBA Phases, EN15978 Pie Chart, Discipline Breakdown

Implement all of the following in one pass. Read every section before writing any code.

---

### 1. RIBA PLAN OF WORK Data

Add a backend endpoint `POST /api/projects/{id}/phases/seed-riba` that seeds the project
with RIBA Plan of Work 2020 phases if no phases exist yet. Each phase maps to a discipline
gate and a LOIN level.

Seed this exact data (order_index 0–7):

```python
RIBA_PHASES = [
    {"order_index": 0, "name": "Strategic Definition",    "code": "R0", "color": "#4e6a8a", "loin": 0, "gate": None},
    {"order_index": 1, "name": "Preparation & Brief",     "code": "R1", "color": "#3b7dd8", "loin": 1, "gate": "EIR"},
    {"order_index": 2, "name": "Concept Design",          "code": "R2", "color": "#00c8a0", "loin": 2, "gate": "SD"},
    {"order_index": 3, "name": "Spatial Coordination",    "code": "R3", "color": "#3b9eff", "loin": 3, "gate": "DD"},
    {"order_index": 4, "name": "Technical Design",        "code": "R4", "color": "#f4a031", "loin": 4, "gate": "TD"},
    {"order_index": 5, "name": "Manufacturing & Constr.", "code": "R5", "color": "#e05252", "loin": 5, "gate": "Constr"},
    {"order_index": 6, "name": "Handover",                "code": "R6", "color": "#b07ee8", "loin": 6, "gate": "AIM"},
    {"order_index": 7, "name": "Use",                     "code": "R7", "color": "#7a9ab8", "loin": 7, "gate": "FM"},
]
```

Add `code`, `loin`, and `gate` columns to the Phase model via a new Alembic migration.
Make them nullable so existing phases are not broken.

---

### 2. DISCIPLINES — New Model & API

Create a new SQLAlchemy model `Discipline` with fields:
- `id` (int PK autoincrement)
- `project_id` (FK → Project)
- `name` (str) — e.g. "Architecture", "Structural", "MEP", "Civil / Site"
- `code` (str) — e.g. "ARCH", "STRUCT", "MEP", "CIVIL"
- `color` (str) — hex color
- `order_index` (int)

Add a `seed-disciplines` endpoint `POST /api/projects/{id}/disciplines/seed` with these defaults:

```python
DEFAULT_DISCIPLINES = [
    {"code": "ARCH",   "name": "Architecture",   "color": "#3b9eff", "order_index": 0},
    {"code": "STRUCT", "name": "Structural",      "color": "#f4a031", "order_index": 1},
    {"code": "MEP",    "name": "MEP",             "color": "#00c8a0", "order_index": 2},
    {"code": "CIVIL",  "name": "Civil / Site",    "color": "#b07ee8", "order_index": 3},
]
```

Also add CRUD endpoints:
- `GET /api/projects/{id}/disciplines`
- `POST /api/projects/{id}/disciplines`
- `PATCH /api/disciplines/{id}`
- `DELETE /api/disciplines/{id}`

---

### 3. LCA DATA MODEL — EN 15978 Lifecycle Stages

Create a new model `LCAEntry` with fields:
- `id` (int PK)
- `project_id` (FK → Project)
- `phase_id` (FK → Phase, nullable)
- `discipline_id` (FK → Discipline, nullable)
- `ifc_entity` (str) — e.g. "IfcWall"
- `element_name` (str)
- `quantity_value` (float)
- `quantity_unit` (str) — "m", "m2", "m3", "kg", "nr"
- `material` (str)
- `bsdd_uri` (str) — full bsDD property URI
- `gwp_factor` (float) — kgCO2e per unit from bsDD
- `mass_kg` (float)
- `gwp_a1a3` (float) — product stage
- `gwp_a4a5` (float) — construction (projected = gwp_a1a3 * 0.08)
- `gwp_b1b7` (float) — use stage (null until TD gate)
- `gwp_c1c4` (float) — end of life (null until TD)
- `gwp_d`    (float) — beyond boundary (null until TD)
- `en15978_scope` (str) — comma-separated active stages e.g. "A1,A2,A3,A4,A5"
- `confidence` (str) — "order_of_magnitude", "indicative", "detailed", "certified"

Add API endpoints:
- `GET /api/projects/{id}/lca` — returns all entries, supports ?phase_id= and ?discipline_id= filters
- `POST /api/projects/{id}/lca` — create entry
- `POST /api/projects/{id}/lca/bulk` — create multiple entries (list)
- `DELETE /api/lca/{entry_id}`
- `GET /api/projects/{id}/lca/summary` — returns the aggregated summary (see section 6)

---

### 4. FRONTEND — New Route `/projects/:id/lca`

Add a new tab "Carbon / LCA" to the project detail page navigation alongside the existing
"Matrix", "Compare", "Export" tabs.

Create `frontend/src/pages/LCADashboard.tsx` — a full dashboard with these sections:

#### 4a. RIBA Phase Selector (top bar)

A horizontal scrollable row of phase pills using the seeded RIBA phases.
Clicking a phase filters all charts and tables below.
Active phase pill is highlighted in its `color`.
Show gate label (SD / DD / TD / AIM) as a small badge next to phase name.
Add a "Seed RIBA Phases" button that calls the seed endpoint if phases list is empty.

#### 4b. Discipline Filter Bar

A row of discipline toggle buttons (multi-select, all active by default).
Each button shows the discipline color dot + name.
Toggling filters the charts and table below.
Add a "Seed Disciplines" button if disciplines list is empty.

#### 4c. KPI Cards Row

Four metric cards in a grid (2x2 on mobile, 4x1 on desktop):
1. **ILS 17** — Total Material Mass (kg) — blue accent
2. **ILS 18** — GWP A1–A3 (kgCO2e) — teal accent
3. **ILS 19** — Whole Life Carbon estimate (kgCO2e) — amber accent
4. **Confidence** — current LOIN level badge + "±30% SD" label — muted

All values react to the active phase + discipline filters.

#### 4d. EN 15978 Lifecycle Stage Pie Chart

Use Recharts `PieChart` / `Pie` with `Cell` for a donut chart.

Segments = EN 15978 lifecycle stage groups:
- A1–A3 Product Stage (teal #00c8a0)
- A4–A5 Construction (blue #3b9eff)
- B1–B7 Use Stage (amber #f4a031) — shown as projected/hatched if not yet calculable
- C1–C4 End of Life (red #e05252) — projected
- D Beyond Boundary (purple #b07ee8) — projected

Inside the donut hole: show total GWP value in kgCO2e.

Show a custom legend below the chart with:
- Colored square + stage group name + value + % of total
- Stages not yet calculable at current LOIN show "— projected" in muted text

#### 4e. Discipline Breakdown Stacked Bar Chart

Use Recharts `BarChart` with stacked bars.

X-axis = EN 15978 module groups (A1-A3, A4-A5, B, C, D)
Y-axis = kgCO2e
Each bar is stacked by discipline color.

Clicking a bar segment filters the table below to that discipline + stage.
Show a tooltip with discipline name, stage, value, and % of total.

#### 4f. GWP by RIBA Phase Line Chart

Use Recharts `LineChart`.

X-axis = RIBA phase codes (R0–R7)
Y-axis = cumulative GWP kgCO2e
One line per discipline (discipline color) + one total line in white/light.

Show vertical dashed lines at SD (R2), DD (R3), TD (R4) gates.
Show confidence band (shaded area) that narrows from R2 to R4.

This replaces / supplements the existing Slide 7 bar chart.

#### 4g. LCA Elements Table

A sortable, filterable table showing all LCAEntry rows for current phase + discipline filters.

Columns:
| Element | IFC Entity | Discipline | Qty | Material | bsDD URI (linked) | GWP Factor | A1-A3 | A4-A5 | Flag |

Flag column: green dot = all required properties present + unit valid,
amber dot = optional properties missing, red dot = required property missing or unit mismatch.

Add row-level expand to show: full bsDD URI, confidence level, EN 15978 scope, and which
IDS properties were checked.

At the bottom: totals row in bold.

#### 4h. bsDD Connection Banner

A compact info bar showing:
`IDS property uri= → bsDD identifier.buildingsmart.org/uri/… → dataType + unit + GWP_A1-A3 → validated`
Style as a chain of connected pills with arrows between them.
Link "bsDD" opens https://search.bsdd.buildingsmart.org in a new tab.

---

### 5. SAMPLE DATA — Seed Endpoint

Add `POST /api/projects/{id}/lca/seed-sample` that populates realistic sample LCA data
for all 4 default disciplines at RIBA R2 (Concept Design / SD gate).

Use these values (match the existing HTML mockup in `ids_precheck_stage1.html`):

```python
SAMPLE_LCA = {
    "ARCH": [
        {"element_name":"External wall",       "ifc_entity":"IfcWall",           "quantity_value":450,  "quantity_unit":"m2",  "material":"Concrete",         "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossArea",             "gwp_factor":0.103, "mass_kg":186300},
        {"element_name":"Ground floor slab",   "ifc_entity":"IfcSlab",           "quantity_value":820,  "quantity_unit":"m2",  "material":"Reinforced conc.", "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NetFloorArea",          "gwp_factor":0.137, "mass_kg":393600},
        {"element_name":"Roof structure",      "ifc_entity":"IfcRoof",           "quantity_value":600,  "quantity_unit":"m2",  "material":"Timber (CLT)",     "bsdd_uri":"https://identifier.buildingsmart.org/uri/TUe/DOR/0.0.2/prop/BiogenicCarbonContent",       "gwp_factor":0.390, "mass_kg":48000},
        {"element_name":"Glazing facade",      "ifc_entity":"IfcCurtainWall",    "quantity_value":180,  "quantity_unit":"m2",  "material":"Glass / Al frame", "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/IsExternal",           "gwp_factor":8.240, "mass_kg":7200},
        {"element_name":"Internal partition",  "ifc_entity":"IfcWall",           "quantity_value":310,  "quantity_unit":"m2",  "material":"Brick / mortar",   "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossArea",             "gwp_factor":0.241, "mass_kg":62000},
    ],
    "STRUCT": [
        {"element_name":"Foundation pads",     "ifc_entity":"IfcFooting",        "quantity_value":320,  "quantity_unit":"m3",  "material":"RC concrete",      "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GroundReactionForce",  "gwp_factor":0.137, "mass_kg":768000},
        {"element_name":"Primary beams",       "ifc_entity":"IfcBeam",           "quantity_value":2400, "quantity_unit":"kg",  "material":"Structural steel", "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/LoadBearing",          "gwp_factor":1.460, "mass_kg":2400},
        {"element_name":"Columns",             "ifc_entity":"IfcColumn",         "quantity_value":1800, "quantity_unit":"kg",  "material":"Structural steel", "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/LoadBearing",          "gwp_factor":1.460, "mass_kg":1800},
        {"element_name":"Retaining wall",      "ifc_entity":"IfcWall",           "quantity_value":85,   "quantity_unit":"m3",  "material":"Concrete",         "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossVolume",           "gwp_factor":0.103, "mass_kg":204000},
    ],
    "MEP": [
        {"element_name":"Hot water pipework",  "ifc_entity":"IfcPipeSegment",    "quantity_value":320,  "quantity_unit":"m",   "material":"Copper",           "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NominalLength",         "gwp_factor":3.500, "mass_kg":3200},
        {"element_name":"Ductwork supply",     "ifc_entity":"IfcDuctSegment",    "quantity_value":850,  "quantity_unit":"m2",  "material":"Galv. steel",      "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/CrossSectionArea",      "gwp_factor":2.130, "mass_kg":3400},
        {"element_name":"Chilled water pipes", "ifc_entity":"IfcPipeSegment",    "quantity_value":280,  "quantity_unit":"m",   "material":"Steel (galv.)",    "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NominalLength",         "gwp_factor":2.130, "mass_kg":2520},
        {"element_name":"AHU units",           "ifc_entity":"IfcAirHandlingUnit","quantity_value":4,    "quantity_unit":"nr",  "material":"Steel / Al",       "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/NominalAirFlowRate",   "gwp_factor":3.200, "mass_kg":2400},
    ],
    "CIVIL": [
        {"element_name":"Site roads",          "ifc_entity":"IfcRoad",           "quantity_value":2400, "quantity_unit":"m2",  "material":"Asphalt",          "bsdd_uri":"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/GrossArea",             "gwp_factor":0.062, "mass_kg":240000},
        {"element_name":"Earthworks cut",      "ifc_entity":"IfcEarthworksCut",  "quantity_value":1800, "quantity_unit":"m3",  "material":"Soil removal",     "bsdd_uri":"https://identifier.buildingsmart.org/uri/TUe/DOR/0.0.2/prop/InterventionRequirement",     "gwp_factor":0.005, "mass_kg":3240000},
        {"element_name":"Earthworks fill",     "ifc_entity":"IfcEarthworksFill", "quantity_value":950,  "quantity_unit":"m3",  "material":"Gravel fill",      "bsdd_uri":"https://identifier.buildingsmart.org/uri/TUe/DOR/0.0.2/prop/InterventionRequirement",     "gwp_factor":0.007, "mass_kg":1710000},
    ],
}
```

For each entry, compute on insert:
- `gwp_a1a3 = mass_kg * gwp_factor`
- `gwp_a4a5 = gwp_a1a3 * 0.08`   (EN 15978 transport projection)
- `gwp_b1b7 = None`               (not calculable at LOIN 2)
- `gwp_c1c4 = None`
- `gwp_d    = None`
- `en15978_scope = "A1,A2,A3,A4,A5"` (A1-A3 from bsDD, A4-A5 projected)
- `confidence = "order_of_magnitude"` (LOIN 2 = ±30%)

---

### 6. SUMMARY ENDPOINT — `GET /api/projects/{id}/lca/summary`

Returns a JSON object with this shape (all values filtered by optional ?phase_id= and
?discipline_ids= query params):

```json
{
  "ils17_mass_kg": 1234567,
  "ils18_gwp_a1a3": 89432,
  "ils19_wlc_estimate": 196750,
  "confidence": "order_of_magnitude",
  "loin_level": 2,
  "en15978_stages": {
    "A1-A3": 89432,
    "A4-A5": 7155,
    "B1-B7": null,
    "C1-C4": null,
    "D":     null
  },
  "by_discipline": [
    {"code": "ARCH",   "name": "Architecture", "color": "#3b9eff", "gwp_a1a3": 45000, "mass_kg": 697100},
    {"code": "STRUCT", "name": "Structural",   "color": "#f4a031", "gwp_a1a3": 22000, "mass_kg": 976200},
    {"code": "MEP",    "name": "MEP",          "color": "#00c8a0", "gwp_a1a3": 14000, "mass_kg": 11520},
    {"code": "CIVIL",  "name": "Civil / Site", "color": "#b07ee8", "gwp_a1a3": 8432,  "mass_kg": 5190000}
  ],
  "by_riba_phase": [
    {"phase_code": "R2", "phase_name": "Concept Design", "gwp_total": 89432, "confidence": "order_of_magnitude"},
    {"phase_code": "R3", "phase_name": "Spatial Coord.", "gwp_total": null,  "confidence": null},
    {"phase_code": "R4", "phase_name": "Technical Design","gwp_total": null, "confidence": null}
  ],
  "top_contributor": {"element_name": "...", "gwp_a1a3": 59328, "discipline": "ARCH"}
}
```

ILS19 WLC estimate formula at SD:
`wlc_estimate = gwp_a1a3 * 2.2`
(×2.2 is a conservative whole-life projection per RICS WLCA guidance for SD phase)

---

### 7. CALCULATION — EN 15978 STAGE VALIDATION

In the summary endpoint, before returning `en15978_stages`, check each stage is valid:

- **A1** = raw material extraction. Valid if `material` field is populated.
- **A2** = transport to manufacturer. Always projected from A1 using factor 0.02.
- **A3** = manufacturing. `gwp_factor` from bsDD covers A1-A3 combined — mark all three active.
- **A4** = transport to site. Projected: `gwp_a1a3 * 0.05`.
- **A5** = installation. Projected: `gwp_a1a3 * 0.03`.
- **B1-B7** = null unless `loin >= 4` (TD gate).
- **C1-C4** = null unless `loin >= 4`.
- **D**    = null unless `loin >= 4`.

For each LCAEntry, write a field `stage_check` (JSON dict) storing which stages passed.
Return this in the `/lca` list endpoint per row.

---

### 8. IDS PROPERTY VALIDATION HOOK

When a new LCAEntry is created, run a validation check:

1. **Property present?** — check that `bsdd_uri` is non-empty. Flag: `ok` / `missing_uri`.
2. **Unit valid?** — look up `quantity_unit` against allowed units for the IFC entity:
   - `IfcPipeSegment`, `IfcDuctSegment` → must be "m" or "m2"
   - `IfcWall`, `IfcSlab`, `IfcRoof` → must be "m2" or "m3"
   - `IfcBeam`, `IfcColumn`, `IfcMember` → must be "kg" or "m"
   - `IfcFooting` → must be "m3"
   - All others → any unit accepted
   If wrong unit: flag `unit_mismatch` and block GWP calculation for that row.
3. **GWP factor present?** — if `gwp_factor` is 0 or null, flag `missing_gwp_factor`.

Store the validation result in a `flag` field: `"ok"`, `"warn"`, or `"error"`.
Return this in the table so the frontend can show the colored dot.

---

### 9. ALEMBIC MIGRATIONS

Create one new Alembic migration file that adds:
- `phases.code` (String, nullable)
- `phases.loin` (Integer, nullable)
- `phases.gate` (String, nullable)
- New table `disciplines`
- New table `lca_entries`

Use `op.add_column` for the phases additions and `op.create_table` for the new tables.
Run: `alembic upgrade head`

---

### 10. FRONTEND TYPES

Add to `frontend/src/types/`:

`discipline.ts`:
```typescript
export interface Discipline {
  id: number;
  project_id: number;
  name: string;
  code: string;
  color: string;
  order_index: number;
}
```

`lca.ts`:
```typescript
export interface LCAEntry {
  id: number;
  project_id: number;
  phase_id: number | null;
  discipline_id: number | null;
  ifc_entity: string;
  element_name: string;
  quantity_value: number;
  quantity_unit: string;
  material: string;
  bsdd_uri: string;
  gwp_factor: number;
  mass_kg: number;
  gwp_a1a3: number;
  gwp_a4a5: number | null;
  gwp_b1b7: number | null;
  gwp_c1c4: number | null;
  gwp_d: number | null;
  en15978_scope: string;
  confidence: 'order_of_magnitude' | 'indicative' | 'detailed' | 'certified';
  flag: 'ok' | 'warn' | 'error';
}

export interface LCASummary {
  ils17_mass_kg: number;
  ils18_gwp_a1a3: number;
  ils19_wlc_estimate: number;
  confidence: string;
  loin_level: number;
  en15978_stages: Record<string, number | null>;
  by_discipline: Array<{code:string; name:string; color:string; gwp_a1a3:number; mass_kg:number}>;
  by_riba_phase: Array<{phase_code:string; phase_name:string; gwp_total:number|null; confidence:string|null}>;
  top_contributor: {element_name:string; gwp_a1a3:number; discipline:string};
}
```

---

### 11. RECHARTS CHART COMPONENTS

Create `frontend/src/components/lca/`:

#### `LCADonutChart.tsx`
- PieChart with inner radius 65, outer radius 110
- Segments: A1-A3, A4-A5, B1-B7, C1-C4, D
- Null/projected segments shown with opacity 0.3 and dashed stroke (use `strokeDasharray`)
- Center label: total GWP in large text + "kgCO₂e" in smaller text
- Custom legend below as flex row of colored squares + label + value + %
- Tooltip: stage name, value, % of total, "projected" note if null

#### `LCADisciplineStackedBar.tsx`
- BarChart stacked
- X: stage groups, Y: kgCO2e
- One `Bar` per discipline, each with its `color`
- Null values shown as a hatched pattern `fill="url(#hatch)"` with a `<defs>` pattern
- Click handler on bar segment: emits `onFilter(disciplineCode, stageGroup)`

#### `LCAPhaseLineChart.tsx`
- LineChart
- X: RIBA phase codes R0–R7
- One `Line` per discipline + one total line
- `ReferenceLine` at x="R2" (SD), x="R3" (DD), x="R4" (TD) with labels
- Confidence band as `Area` with low opacity between R2-R4
- Null future phases shown as dashed line segments

#### `LCAElementsTable.tsx`
- Table with columns: Element, IFC Entity, Discipline pill, Qty, Material, bsDD URI (clickable),
  GWP Factor, A1-A3 (kgCO2e), A4-A5, Flag dot
- Sortable by any numeric column
- Expandable rows showing: full bsDD URI, confidence, EN 15978 scope, IDS check result
- Totals row at bottom
- "Add row" button that opens an inline form for manual entry

---

### 12. INTEGRATION — Wire Everything Together

In `LCADashboard.tsx`:

```typescript
// 1. On mount: fetch phases, disciplines, lca summary, lca entries
// 2. If phases.length === 0: show "Seed RIBA Phases" button
// 3. If disciplines.length === 0: show "Seed Disciplines" button
// 4. If lca entries === 0: show "Load Sample Data" button → calls /lca/seed-sample
// 5. Active phase filter stored in useState<number|null>
// 6. Active discipline filter stored in useState<string[]> (codes, default all)
// 7. Re-fetch summary when filters change
// 8. Pass filtered data down to each chart component
```

Add a "Run IDS Check" button that calls a new endpoint
`POST /api/projects/{id}/lca/validate` which re-runs the property validation hook
on all entries and returns updated flags. The table re-renders with new flag dots.

---

### 13. STYLING NOTES

Use the existing Tailwind dark theme. Key colors to use:
- Teal (`#00c8a0`) for ILS18 GWP and A1-A3
- Blue (`#3b9eff`) for ILS17 mass
- Amber (`#f4a031`) for ILS19 WLC and A4-A5
- Red (`#e05252`) for C stages and flags
- Purple (`#b07ee8`) for D stage
- Navy panels (`#111f35`) matching the existing HTML mockup

Font: `IBM Plex Mono` for all metric values and codes, `IBM Plex Sans` for labels.
These are already loaded in `ids_precheck_stage1.html` — add them to `index.html` if not present.

---

### 14. FINAL CHECKLIST

Before finishing, verify:
- [ ] `alembic upgrade head` runs without error
- [ ] `GET /api/projects/1/lca/summary` returns correct ILS17/18/19 values
- [ ] `POST /api/projects/1/phases/seed-riba` creates 8 RIBA phases
- [ ] `POST /api/projects/1/lca/seed-sample` populates 15 sample entries
- [ ] Donut chart renders with correct segments and center value
- [ ] Stacked bar chart shows discipline breakdown per EN 15978 stage group
- [ ] Line chart shows phase evolution with SD/DD/TD reference lines
- [ ] Table flags copper pipe row as `ok`, missing bsDD rows as `warn`
- [ ] ILS17, ILS18, ILS19 KPI cards update when discipline filter changes
- [ ] "Run IDS Check" re-validates and updates flag dots
- [ ] All existing Matrix / Compare / Export tabs still work

---

### REFERENCE FILES ALREADY IN PROJECT

- `ids_precheck_stage1.html` — HTML mockup with exact styling, data and calculation logic to match
- `frontend/src/components/SpecMatrix.tsx` — pattern to follow for table components
- `CLAUDE.md` — original build prompt for full project context

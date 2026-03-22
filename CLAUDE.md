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

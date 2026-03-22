# IDS Phase Editor — Claude Code Build Prompt

Paste this prompt into Claude Code in VS Code to scaffold the full local application.

---

## PROMPT

Build a full-stack web application called **IDS Phase Editor** — a tool for managing and splitting IFC Information Delivery Specification (IDS) files by project phase.

The IDS format is an open buildingSMART standard: https://github.com/buildingSMART/IDS

---

### STACK

- **Backend**: Python + FastAPI + SQLite (via SQLAlchemy + Alembic)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
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

### DATABASE SCHEMA

```
projects
  id, name, description, created_at, updated_at

ids_files
  id, project_id, filename, raw_xml, parsed_json, uploaded_at

phases
  id, project_id, name, color, order_index, created_at

phase_matrix
  id, project_id, spec_id (string), requirement_key (string), phase_id, status (required|optional|excluded)
```

---

### API ROUTES (FastAPI)

```
POST   /api/projects                        # create project
GET    /api/projects                        # list all projects
GET    /api/projects/{id}                   # get project detail
DELETE /api/projects/{id}                   # delete project

POST   /api/projects/{id}/upload            # upload .ids file (multipart)
GET    /api/projects/{id}/ids               # get parsed IDS structure

POST   /api/projects/{id}/phases            # add phase
PUT    /api/projects/{id}/phases/{phase_id} # rename / reorder phase
DELETE /api/projects/{id}/phases/{phase_id} # delete phase

GET    /api/projects/{id}/matrix            # get full phase matrix
PUT    /api/projects/{id}/matrix            # update one cell {spec_id, req_key, phase_id, status}

GET    /api/projects/{id}/export/{phase_id} # download .ids for one phase
GET    /api/projects/{id}/export            # download ZIP of all phases
```

---

### FRONTEND STRUCTURE

```
src/
  components/
    Layout.tsx              # sidebar + header shell
    ProjectList.tsx         # dashboard / project cards
    ProjectDetail.tsx       # main project view with tabs
    UploadZone.tsx          # drag-and-drop IDS uploader
    PhaseManager.tsx        # add/remove/reorder phases
    SpecMatrix.tsx          # the requirement × phase matrix table
    StatusSelector.tsx      # REQ / OPT / — toggle per cell
    CompareView.tsx         # side-by-side phase summary cards
    ExportPanel.tsx         # export controls
  hooks/
    useProject.ts           # project data fetching
    useMatrix.ts            # matrix state + auto-save
  api/
    client.ts               # typed API wrapper (fetch)
  types/
    ids.ts                  # IDS data types
    project.ts              # project, phase, matrix types
  App.tsx
  main.tsx
```

---

### VISUAL DESIGN

- Clean, professional, minimal — appropriate for BIM/AEC industry users
- Light mode default, dark mode support via Tailwind
- Color-coded phases (each phase gets a distinct color from a preset palette)
- Status badges:
  - `required` → green background
  - `optional` → amber background  
  - `excluded` → gray, muted
- Monospace font for IDS attribute/property names (e.g. `JetBrains Mono` or `IBM Plex Mono`)
- Serif display font for headings (e.g. `Lora` or `Playfair Display`)
- Responsive layout — sidebar collapses on narrow screens

---

### IDS XML PARSING NOTES

- Namespace: `http://standards.buildingsmart.org/IDS`
- Use Python's `lxml` or `xml.etree.ElementTree` for parsing
- Spec name is in `<specification name="...">` attribute
- Requirements are direct children of `<requirements>` element
- Each requirement type: `attribute`, `property`, `material`, `classification`, `partOf`
- `minOccurs` attribute on requirement element determines base optionality
- `<simpleValue>` is the most common value container
- Property requirements have `<propertySet>` and `<baseName>` children
- When exporting, preserve all XML attributes and child elements — only modify `minOccurs`

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

### FILE STRUCTURE TO GENERATE

```
ids-phase-editor/
  backend/
    main.py                 # FastAPI app entry point
    models.py               # SQLAlchemy models
    schemas.py              # Pydantic schemas
    database.py             # DB connection + session
    ids_parser.py           # IDS XML parser
    ids_exporter.py         # IDS XML generator for export
    routers/
      projects.py
      phases.py
      matrix.py
      export.py
    alembic/                # DB migrations
    requirements.txt
  frontend/
    src/                    # as above
    index.html
    vite.config.ts
    tailwind.config.ts
    tsconfig.json
    package.json
  README.md
  .gitignore
```

---

### IMPORTANT NOTES

1. **All UI text must be in English**
2. The app must work fully offline (no external API calls at runtime)
3. SQLite database file stored at `backend/ids_editor.db`
4. CORS configured for `localhost:5173` → `localhost:8000`
5. Include sample `.ids` file in `backend/sample_data/` for testing
6. Add loading states and error handling for all async operations
7. Export filenames: `{project-name}_{phase-name}.ids` (slugified, lowercase)
8. ZIP export filename: `{project-name}_all-phases_{date}.zip`

---

Start by scaffolding the full directory structure, then implement backend first (models → parser → routes), then frontend.

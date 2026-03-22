# IDS Matrix Builder — Full Redesign Prompt

This is a major redesign of the `ids-phase-editor` project. Treat this as a rewrite of the core application flow. Keep all previously built infrastructure (DB connection, file storage, ifcopenshell integration, IDSSplitNode) but rebuild the UI flow and data model from scratch according to the spec below.

---

## OVERVIEW

The application is now called **IDS Matrix Builder**. Its purpose is to let BIM managers build new IDS files for each discipline × phase combination by dragging requirements from uploaded source IDS files into a requirements matrix.

The core mental model:
- **Phases** = columns (e.g. Concept, Schematic Design, Construction)
- **Disciplines** = rows (e.g. Architecture, Structure, MEP, Civil)
- **Matrix cell** = one future IDS file (discipline × phase)
- Each cell contains requirements dragged in from source IDS files
- Each cell can be exported as a valid `.ids` file

---

## APPLICATION FLOW (tab order)

```
1. Setup        → Define phases + disciplines
2. IDS Sources  → Upload one or more source IDS files
3. Matrix       → Build the requirements matrix (main workspace)
4. Export       → Export IDS files per cell / discipline / phase / all
```

Tabs are always visible in the top navigation. The user must complete Setup before accessing Matrix. IDS Sources can be populated at any time.

---

## TAB 1 — SETUP

### Phases (columns)
- User adds custom phases in order (e.g. "LOD 100", "LOD 200", "Construction")
- Each phase has: name, optional description, color (picked from preset palette)
- Phases can be reordered via drag-and-drop (use a simple up/down arrow or drag handle)
- Phases can be renamed or deleted (with confirmation if matrix has data)

### Disciplines (rows)
- User adds custom disciplines (e.g. "Architecture", "Structure", "MEP", "Civil", "Geotechnics")
- Each discipline has: name, optional abbreviation (shown in matrix row header), color
- Disciplines can be reordered, renamed, deleted (same rules as phases)

### Layout
- Two-column layout: left = Phases, right = Disciplines
- Each column has a list of items with add form at the bottom
- Show a small preview of the matrix grid at the bottom of the page (discipline rows × phase columns, cells are empty placeholders)

### DB schema additions
```
disciplines
  id, project_id, name, abbreviation, color, order_index, created_at
```
(phases table already exists — add `description` column if not present)

---

## TAB 2 — IDS SOURCES

### Multiple IDS upload
- User can upload **multiple** `.ids` files (one at a time or batch)
- Each uploaded IDS is shown as a card: filename, title from `<info>`, author, date, number of specifications
- Cards can be removed (with confirmation if requirements from this IDS are used in the matrix)
- No limit on number of uploaded IDS files

### IDS tree browser (read-only preview)
- Each IDS card has an "Inspect" button that opens an expandable tree panel below the card
- Tree structure:
  ```
  📄 IDS filename / title
  └── 📋 Specification: "Load-bearing Walls"   [entity: IFCWALL]
      ├── 📌 Applicability
      │   └── Entity: IFCWALL / predefinedType: LOAD_BEARING
      ├── 📦 Applicability Group: "Standard walls"   ← if multiple applicability blocks
      │   ├── Entity: IFCWALL
      │   └── Property: Pset_WallCommon / IsExternal
      └── 📋 Requirements
          ├── ⬡ Property: Pset_WallCommon / FireRating   [optional]
          ├── ⬡ Property: Pset_WallCommon / IsExternal   [required]
          └── ⬡ Attribute: Name   [required]
  ```
- This tree is **for reference only** here — dragging happens from the Matrix tab panel

### DB schema additions
```
ids_sources
  id, project_id, filename, title, author, date, version, raw_xml, parsed_json, uploaded_at
```
(replace/rename existing `ids_files` table — support multiple per project)

---

## TAB 3 — MATRIX (main workspace)

This is the core of the application. It is a two-panel layout:

```
┌─────────────────────────────────────┬──────────────────┐
│  REQUIREMENTS MATRIX  (left, ~65%)  │  IDS BROWSER     │
│                                     │  (right, ~35%)   │
│  [Phase filters] [Discipline filter]│                  │
│                                     │  Collapsible     │
│  ┌──────┬──────┬──────┬──────┐     │  tree of all     │
│  │      │ Ph 1 │ Ph 2 │ Ph 3 │     │  uploaded IDS    │
│  ├──────┼──────┼──────┼──────┤     │  files with      │
│  │ ARQ  │  [ ] │  [ ] │  [ ] │     │  drag handles    │
│  ├──────┼──────┼──────┼──────┤     │                  │
│  │ STR  │  [ ] │  [ ] │  [ ] │     │                  │
│  ├──────┼──────┼──────┼──────┤     │                  │
│  │ MEP  │  [ ] │  [ ] │  [ ] │     │                  │
│  └──────┴──────┴──────┴──────┘     │                  │
└─────────────────────────────────────┴──────────────────┘
```

### Left panel — Requirements Matrix

#### Filters (above the matrix)
- **Phase filter**: multi-select checkboxes — show/hide individual phase columns
- **Discipline filter**: multi-select checkboxes — show/hide individual discipline rows
- "Reset filters" link

#### Matrix table
- Sticky first column (discipline names) — scrolls horizontally for many phases
- Sticky header row (phase names) — scrolls vertically for many disciplines
- Each cell is a **drop zone** (highlighted on drag-over with a dashed green border)
- Cells that have content show a compact summary: "3 specs · 12 requirements"
- Clicking an empty or filled cell **expands it into an edit view** (see below)

#### Cell expanded view
When a user clicks a cell (discipline × phase), the cell expands inline OR opens a slide-in panel from the bottom. Show:

**Header section:**
- "Header" block at the top of the cell
- Shows: IDS Title, Author, Date, Version, Description (all editable inline)
- A "Use header from IDS" dropdown — pick one of the uploaded IDS sources to copy its `<info>` block as starting point
- Fields are free-text editable after copying

**Requirements section:**
- List of all requirements added to this cell, grouped by how they were added:
  - **Specification group** (if a full spec was dragged): shows spec name as group header
    - Sub-groups per Applicability block
      - Individual requirements listed
  - **Applicability group** (if an applicability block was dragged): shows applicability summary as group header
    - Individual requirements listed
  - **Single requirement** (if a single requirement was dragged): shown standalone

- For each **group** (spec or applicability level):
  - Collapse/expand toggle
  - "Remove group" button (removes all requirements in the group from this cell)
  - "Apply to all phases" button on spec groups

- For each **individual requirement**:
  - Requirement type icon (P=property, A=attribute, M=material, C=classification)
  - Requirement name / property set + base name
  - **Status pill** — clickable toggle cycling through: `required` → `optional` → `prohibited`
    - `required`: green pill
    - `optional`: amber pill
    - `prohibited`: red pill
  - **Remove button** (×) — removes just this requirement, leaving the rest of its group intact

#### "Apply to all phases?" dialog
When the user drops a **specification** or **applicability group** onto a cell, show a modal dialog:

```
"Apply to all phases in [Discipline Name]?"

You dropped "[Spec name]" onto [Discipline] / [Phase].
Would you like to add it to all phases for this discipline?

  [Apply to this phase only]    [Apply to all phases]
```

When the user drops a **single requirement**: no dialog, add directly to the target cell only.

### Right panel — IDS Browser (drag source)

- Collapsible (toggle button to hide/show, saves more space for the matrix)
- Shows all uploaded IDS files as a tree (same structure as Tab 2 inspect view)
- Every draggable node has a drag handle icon (⠿) on the left
- Three levels of draggable items:
  1. **Full Specification** — drags the entire spec (all applicability + all requirements)
  2. **Applicability group** — drags one applicability block + its associated requirements
  3. **Individual Requirement** — drags one requirement facet only
- Visual drag state: the dragged item gets a ghost card showing what will be dropped
- Drop zones in the matrix highlight green when a valid drag is in progress

---

## DATA MODEL FOR MATRIX CELLS

Each matrix cell (discipline × phase) stores:

```
matrix_cells
  id, project_id, discipline_id, phase_id, header_json, created_at, updated_at

cell_entries
  id, cell_id, source_ids_id, entry_type (specification|applicability|requirement),
  spec_name, applicability_json, requirement_json, status (required|optional|prohibited),
  group_key (UUID — ties requirements that were dropped together),
  group_type (specification|applicability|standalone),
  order_index, created_at
```

`header_json` structure:
```json
{
  "title": "Structure IDS — Concept Phase",
  "author": "BIM Manager",
  "date": "2025-03-01",
  "version": "1.0",
  "description": "Requirements for structural discipline at concept stage",
  "copyright": ""
}
```

`requirement_json` stores the raw requirement facet data (type, name, propertySet, baseName, value, minOccurs etc.) sufficient to reconstruct valid IDS XML.

---

## API ROUTES

```
# Setup
POST   /api/projects/{id}/disciplines
GET    /api/projects/{id}/disciplines
PUT    /api/projects/{id}/disciplines/{did}
DELETE /api/projects/{id}/disciplines/{did}

# IDS Sources
POST   /api/projects/{id}/sources              # upload one IDS file
GET    /api/projects/{id}/sources              # list all uploaded IDS files
GET    /api/projects/{id}/sources/{sid}        # get parsed tree structure
DELETE /api/projects/{id}/sources/{sid}        # remove IDS source

# Matrix cells
GET    /api/projects/{id}/matrix               # get all cells (summary: count per cell)
GET    /api/projects/{id}/matrix/{did}/{pid}   # get full cell content
PUT    /api/projects/{id}/matrix/{did}/{pid}/header   # update header
POST   /api/projects/{id}/matrix/{did}/{pid}/entries  # add entries (from drop)
PUT    /api/projects/{id}/matrix/entries/{eid}/status # update req status
DELETE /api/projects/{id}/matrix/entries/{eid}        # delete one requirement
DELETE /api/projects/{id}/matrix/entries/group/{gkey} # delete entire group
DELETE /api/projects/{id}/matrix/{did}/{pid}          # clear entire cell

# Drop endpoint (handles the drag-and-drop add)
POST   /api/projects/{id}/matrix/{did}/{pid}/drop
Body:
{
  "source_ids_id": 3,
  "drop_type": "specification" | "applicability" | "requirement",
  "spec_name": "Load-bearing Walls",
  "applicability_index": 0,        # only for applicability/requirement drop
  "requirement_index": 2,          # only for requirement drop
  "apply_to_all_phases": false      # if true, adds to all phases in this discipline
}
```

---

## TAB 4 — EXPORT

Four export modes, each with a button:

| Button | Exports |
|---|---|
| Export cell | One `.ids` file for selected discipline × phase |
| Export discipline | One `.ids` per phase for a selected discipline (ZIP) |
| Export phase | One `.ids` per discipline for a selected phase (ZIP) |
| Export all | All cells as `.ids` files in a ZIP, organized in folders by discipline |

ZIP folder structure for "Export all":
```
ids-matrix-export-{date}/
  Architecture/
    Architecture_Concept.ids
    Architecture_SchematicDesign.ids
    Architecture_Construction.ids
  Structure/
    Structure_Concept.ids
    ...
```

### IDS XML generation per cell

Each exported `.ids` file:
1. `<info>` block = cell's `header_json`
2. Groups requirements back into `<specification>` blocks by their `group_key` and `spec_name`
3. Each specification gets its `<applicability>` from `applicability_json`
4. Each requirement facet gets `minOccurs="1"` (required), `minOccurs="0"` (optional), or `minOccurs="0" maxOccurs="0"` (prohibited)
5. Valid IDS XML conforming to buildingSMART schema

```
GET  /api/projects/{id}/export/cell/{did}/{pid}         # single .ids file
GET  /api/projects/{id}/export/discipline/{did}         # ZIP
GET  /api/projects/{id}/export/phase/{pid}              # ZIP
GET  /api/projects/{id}/export/all                      # ZIP
```

---

## FRONTEND STRUCTURE

```
src/
  components/
    # Navigation
    AppNav.tsx                    # top tab bar: Setup | IDS Sources | Matrix | Export

    # Tab 1 — Setup
    SetupTab.tsx
    PhaseManager.tsx              # phase list + add form
    DisciplineManager.tsx         # discipline list + add form
    MatrixPreview.tsx             # small grid preview

    # Tab 2 — IDS Sources
    SourcesTab.tsx
    IDSSourceCard.tsx             # card per uploaded IDS
    IDSTreeBrowser.tsx            # expandable tree component (used in Tab 2 + Tab 3)
    IDSTreeNode.tsx               # single tree node, draggable

    # Tab 3 — Matrix
    MatrixTab.tsx
    MatrixFilters.tsx             # phase + discipline multi-select filters
    MatrixGrid.tsx                # the scrollable grid
    MatrixCell.tsx                # one cell — drop zone + summary
    CellEditPanel.tsx             # expanded cell view (slide-in or inline)
    CellHeader.tsx                # header editor within cell
    EntryGroup.tsx                # spec/applicability group in cell
    EntryRow.tsx                  # single requirement row with status toggle
    StatusPill.tsx                # required/optional/prohibited toggle
    ApplyToAllDialog.tsx          # modal: apply to this phase or all phases?
    IDSBrowserPanel.tsx           # right panel — wraps IDSTreeBrowser + collapse toggle

    # Tab 4 — Export
    ExportTab.tsx
    ExportOptions.tsx             # four export mode selectors

  hooks/
    useSetup.ts                   # phases + disciplines CRUD
    useSources.ts                 # IDS source upload + tree
    useMatrix.ts                  # cell read/write, drop handler
    useExport.ts                  # export triggers + download

  api/
    client.ts                     # all typed API calls

  types/
    setup.ts                      # Phase, Discipline
    sources.ts                    # IDSSource, IDSTreeNode
    matrix.ts                     # MatrixCell, CellEntry, CellHeader, DropPayload
    export.ts

  dnd/
    useDrag.ts                    # drag state hook
    useDropZone.ts                # drop zone hook
    DragContext.tsx               # React context carrying dragged item

  App.tsx
  main.tsx
```

---

## DRAG AND DROP IMPLEMENTATION

Use the native HTML5 Drag and Drop API (no external library needed):

- `IDSTreeNode` sets `draggable={true}` and populates `dataTransfer` with a JSON payload:
  ```json
  {
    "sourceIdsId": 3,
    "dropType": "specification",
    "specName": "Load-bearing Walls",
    "applicabilityIndex": null,
    "requirementIndex": null
  }
  ```
- `MatrixCell` handles `onDragOver` (prevent default + add highlight class) and `onDrop`
- On drop: call `POST /api/projects/{id}/matrix/{did}/{pid}/drop`
- If `dropType` is `specification` or `applicability` → show `ApplyToAllDialog` before calling API
- If `dropType` is `requirement` → call API directly, no dialog

Global drag state (via `DragContext`): track whether a drag is in progress so all matrix cells show their drop zone highlight simultaneously.

---

## BACKEND FILE STRUCTURE

```
backend/
  main.py
  models.py                  # add: Discipline, IDSSource, MatrixCell, CellEntry
  schemas.py
  database.py
  ids_parser.py              # update: parse multiple sources, return tree structure
  ids_exporter.py            # update: build IDS from cell entries
  ids_split_node.py          # keep as-is (used internally if needed)
  routers/
    projects.py
    setup.py                 # NEW: phases + disciplines endpoints
    sources.py               # NEW: replaces old upload router
    matrix.py                # REWRITE: cell CRUD + drop endpoint
    export.py                # REWRITE: four export modes
  uploads/
  exports/
  requirements.txt
```

---

## VISUAL DESIGN

- Keep the existing clean AEC-appropriate aesthetic
- Matrix grid: alternating row shading for discipline rows, phase column headers color-coded to phase color
- Discipline row headers: show abbreviation (bold) + full name (small, muted)
- Drop zone highlight: `2px dashed #2E7D32` border + very light green background tint
- Dragging ghost: small card showing the dragged item type icon + name, follows cursor
- Status pills:
  - `required` → `bg-green-100 text-green-800 border border-green-300`
  - `optional` → `bg-amber-100 text-amber-800 border border-amber-300`
  - `prohibited` → `bg-red-100 text-red-800 border border-red-300`
- Cell summary badge: gray pill "3 specs · 12 req"
- IDS browser panel: slightly darker background (`bg-gray-50`), collapsible with smooth transition
- Tree nodes: indent per level, drag handle (⠿) appears on hover

---

## IMPLEMENTATION ORDER

1. DB: add `disciplines`, `ids_sources`, `matrix_cells`, `cell_entries` tables + Alembic migration
2. Backend: `setup.py` router (phases + disciplines CRUD)
3. Backend: `sources.py` router (multi-IDS upload + tree parsing)
4. Backend: `matrix.py` router (cell CRUD + drop endpoint + apply-to-all logic)
5. Backend: `export.py` router (IDS XML generation from cell entries, all four export modes)
6. Frontend: `AppNav.tsx` + tab routing
7. Frontend: Tab 1 — `SetupTab`, `PhaseManager`, `DisciplineManager`, `MatrixPreview`
8. Frontend: Tab 2 — `SourcesTab`, `IDSSourceCard`, `IDSTreeBrowser`, `IDSTreeNode`
9. Frontend: Tab 3 — `DragContext` + `MatrixGrid` + `MatrixCell` (drop zones)
10. Frontend: Tab 3 — `CellEditPanel` + `CellHeader` + `EntryGroup` + `EntryRow` + `StatusPill`
11. Frontend: Tab 3 — `ApplyToAllDialog` + `IDSBrowserPanel` (right panel)
12. Frontend: `MatrixFilters` (phase + discipline visibility toggles)
13. Frontend: Tab 4 — `ExportTab` + `ExportOptions`
14. End-to-end test: upload 2 IDS files → define 3 phases + 3 disciplines → drag requirements into cells → export all

---

## IMPORTANT NOTES

1. All UI text in English
2. The app must work fully offline
3. Preserve existing project infrastructure: SQLite, FastAPI, Vite, Tailwind
4. `ifctester` / `ifcopenshell` stays in requirements — used by IDSSplitNode and future validation
5. Old `phase_matrix` table and old single-IDS upload can be deprecated but keep old migration files
6. Cell entries must store enough raw data to reconstruct valid IDS XML without re-reading the source IDS file (source IDS may be deleted)
7. "Prohibited" in IDS XML = `minOccurs="0" maxOccurs="0"`
8. Group key (UUID) ties together requirements dropped in the same drag action — this is how "remove group" knows what to delete
9. Matrix grid must handle 10+ phases and 10+ disciplines with horizontal + vertical scroll
10. The right-side IDS browser panel must be collapsible to give more room to the matrix

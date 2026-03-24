# Tech Stack

This file summarizes the main technologies used in the `IDS Stage Gate` project.

## Architecture

- Application type: web application
- Architecture model: frontend + backend API
- Application style: modular monolith
- Communication: HTTP / JSON

## AI Solution Layer

### AI architecture style

- Prompt-driven, multi-step transformation pipeline
- Human-in-the-loop review between stages
- Structured-output workflow based on CSV, JSON, and IDS XML
- Retrieval-augmented requirement resolution for IFC semantics

### Target AI orchestration framework

- LangGraph
  planned as the primary orchestration layer for the end-state AI workflow

- Why LangGraph fits this solution
  the repository already defines a graph-like multi-step process with explicit stage boundaries, review checkpoints, and structured state transitions between Step 0, Step 1a, Step 1b, and Step 2

### AI pipeline stages present in this branch

- `system_prompt_step0_doc_to_csv.md`
  document ingestion, translation to English, OCR-aware extraction, and normalization into CSV

- `system_prompt_step1a_spec_discovery.md`
  specification discovery from reviewed CSV, IFC applicability detection, and entity resolution

- `system_prompt_step1b_requirement_fill.md`
  detailed requirement filling with IFC property mapping, bSDD URI lookup, and structured JSON output

- `system_prompt_step2_json_to_ids.md`
  deterministic conversion from structured JSON to IDS 1.0 XML

### AI processing pattern

- Stage 0: unstructured document to normalized CSV
- Stage 1a: CSV to specification-outline JSON
- Stage 1b: outline JSON to fully resolved requirement JSON
- Stage 2: requirement JSON to IDS XML

### AI output formats

- CSV for normalized document content
- JSON for intermediate structured representations
- IDS XML for final deliverables

### Retrieval and knowledge sources assumed by the prompts

- IFC Entity RAG
  used to resolve valid IFC entity names during specification discovery

- IFC Property RAG
  used to resolve IFC property sets, property names, and data types

- bSDD
  used as an external verification source for IFC semantics and canonical URIs

### AI capabilities described by the prompts

- multilingual document understanding
- translation to English
- OCR-assisted text extraction from scans and images
- table and matrix flattening into structured rows
- filtering of non-IFC content such as process, legal, and deliverable clauses
- IFC entity expansion from abstract phrases like "all objects"
- IFC property and attribute mapping
- deterministic IDS 1.0 XML generation

### Current implementation note

- In this repository, the AI layer is represented primarily by prompt specifications and workflow design files.
- No dedicated LLM SDK dependency is currently committed in `backend/requirements.txt` or `frontend/package.json` for this pipeline.
- LangGraph is the intended production orchestration framework for attaching the concrete model runtime later.
- This means the repo already documents the AI orchestration contract and transformation logic, while the LangGraph runtime integration can be attached as the execution layer.

## Frontend

### Core stack

- React `18.3.1`
- React DOM `18.3.1`
- TypeScript `5.4.5`
- Vite `5.3.1`
- React Router DOM `6.23.1`
- Recharts `2.12.7`

### Styling

- Tailwind CSS `3.4.4`
- PostCSS `8.4.38`
- Autoprefixer `10.4.19`

### Frontend developer tooling

- `@vitejs/plugin-react` `4.3.1`
- `@types/react` `18.3.3`
- `@types/react-dom` `18.3.0`

### UI characteristics

- tab-based project workspace
- React functional components
- local state management with React hooks
- charts and visualizations built with Recharts
- responsive layout implemented with Tailwind CSS

## Backend

### Core stack

- Python `3.11+`
- FastAPI `0.111.0`
- Uvicorn `0.29.0`
- Pydantic `2.7.1`
- SQLAlchemy `2.0.30`
- SQLite

### Database and ORM

- SQLite as the local project database
- SQLAlchemy ORM for models and relationships
- session handling via `sessionmaker`

### Migrations

- Alembic `1.13.1`

### Upload handling

- `python-multipart` `0.0.9` for file uploads in FastAPI

## BIM / IDS / IFC Domain Libraries

- IfcOpenShell
  used to open and validate IFC models

- Custom IDS XML parser
  used to parse IDS files and build structured specifications and requirements

## Reporting and Export

- ReportLab `4.2.0`
  used for PDF report generation

## Standards and Formats Used by the Application

- IDS
  Information Delivery Specification

- IFC
  Industry Foundation Classes

- BCF
  export format for validation issues and coordination follow-up

- JSON
  frontend-backend communication and storage of parsed IDS structures

- XML
  input format for IDS files

- Markdown
  prompt specifications for the AI pipeline

- bSDD URIs
  canonical semantic identifiers for IFC properties when available

## Main Responsibility Split

### Frontend is responsible for

- project views and tab navigation
- IDS and IFC import flows
- requirements matrix editing
- comparison views
- validation triggering and result presentation
- export actions from the user interface

### Backend is responsible for

- project API endpoints
- data persistence
- IDS parsing
- requirement-to-matrix mapping
- IFC validation
- export and reporting logic

## Key Technical Modules In The Repository

### AI workflow definitions

- `system_prompt_step0_doc_to_csv.md`
  prompt contract for document-to-CSV conversion

- `system_prompt_step1a_spec_discovery.md`
  prompt contract for discovering IFC-mappable specifications

- `system_prompt_step1b_requirement_fill.md`
  prompt contract for resolving detailed IFC requirements

- `system_prompt_step2_json_to_ids.md`
  prompt contract for IDS XML generation

- `LangGraph` (target runtime)
  intended execution graph for chaining prompt stages, review nodes, and structured outputs

### Backend

- `backend/main.py`
  FastAPI application bootstrap and router registration

- `backend/database.py`
  SQLite and SQLAlchemy configuration

- `backend/models.py`
  ORM data models

- `backend/ids_parser.py`
  IDS parser

- `backend/ifc_validator.py`
  IFC validation logic

- `backend/routers/`
  feature-specific API router layer

### Frontend

- `frontend/src/components/`
  main UI component layer

- `frontend/src/api/client.ts`
  HTTP client used by the frontend

- `frontend/src/hooks/`
  hooks for data loading and synchronization

## Runtime Setup

- Backend runs locally with Uvicorn
- Frontend runs locally with the Vite dev server
- Typical local addresses:
  - frontend: `http://localhost:5173`
  - backend: `http://localhost:8000`
  - API docs: `http://localhost:8000/docs`

## Additional Notes

- The project uses SQLite, which makes it easy to run locally for demos and fast prototyping.
- The repository includes sample data in `IDS_Sample/` and `IFC_Sample/`.
- The application combines IDS workflow management, IFC validation, and export capabilities in a single tool.

# IDS Stage Gate

IDS Stage Gate is a web application for managing Information Delivery Specification (IDS) requirements and validating IFC models against those requirements in a structured project workflow.

The application lets a team:
- define project disciplines and delivery phases,
- import IDS files as requirement sources,
- assign requirements into a discipline-by-phase matrix,
- compare requirement sets,
- validate IFC models against selected matrix cells,
- export curated IDS outputs for downstream use.

## What The App Does

The main idea is to turn IDS from a static document into an operational workflow.

Instead of keeping requirements only inside imported IDS files, IDS Stage Gate lets you map them to project context:
- `Project Setup` defines the project structure,
- `IDS Import` brings requirement sources into the system,
- `IDS Split/Merge` assigns and curates requirements in the matrix,
- `IDS Compare` helps review overlap and differences,
- `IFC Validation` checks model content against matrix requirements,
- `IDS Export` generates deliverable IDS outputs from the curated matrix.

## Core Workflow

### 1. Project Setup

Create the project structure by defining:
- disciplines,
- phases,
- the project metadata that frames the delivery process.

These disciplines and phases become the axes of the IDS matrix.

### 2. IDS Import

Import one or more `.ids` files. The backend parses the IDS XML, stores the raw file, and exposes structured specifications and requirements to the frontend.

Imported IDS files are used as source material for:
- matrix assignment,
- requirement comparison,
- downstream export,
- validation logic.

### 3. IDS Split/Merge

This is the heart of the application.

Requirements from imported IDS files can be assigned to matrix cells defined by:
- one discipline,
- one phase.

Inside a selected cell, the user can:
- review the imported requirements,
- adjust requirement status such as `required`, `optional`, or `prohibited`,
- edit specification metadata,
- inspect requirement type markers,
- open bSDD references when a requirement includes a URI in the original IDS.

### 4. IDS Compare

The compare view helps inspect:
- differences between requirement sets,
- overlap between imported sources,
- changes introduced by matrix curation.

This is useful when multiple IDS files cover similar scopes or when the same requirement evolves across project stages.

### 5. IFC Validation

In the validation view, users:
- upload IFC files,
- select a model,
- select matrix cells to validate,
- review pass/fail summaries,
- inspect requirement-level validation details,
- export BCF data for issue follow-up.

Validation is driven by the curated matrix, not directly by raw imported IDS files.

### 6. IDS Export

After curation, the application can export IDS outputs generated from the matrix content. This enables project-specific IDS deliverables rather than simply reusing the original imported files.

## Main Capabilities

- Project-based workspace with separate disciplines and phases per project
- IDS XML import and parsing
- Discipline x phase matrix for requirement assignment
- Requirement status management at cell level
- Requirement comparison tools
- IFC upload and validation workflow
- BCF export from validation results
- IDS export based on curated matrix content
- bSDD links for requirements that include IDS URIs
- Lightweight UI guidance such as requirement type tooltips

## Architecture

### Frontend

The frontend is built with:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

The frontend provides a tab-based project workspace and communicates with the backend through a thin API client layer in `frontend/src/api/client.ts`.

### Backend

The backend is built with:
- FastAPI
- SQLAlchemy
- SQLite
- Alembic
- IfcOpenShell
- lxml

The backend is responsible for:
- project storage,
- IDS parsing,
- matrix persistence,
- IFC upload handling,
- validation execution,
- export generation.

### Persistence

The application uses SQLite for local persistence. IDS content is stored both as:
- raw XML,
- parsed JSON for application workflows.

Matrix entries store the curated requirement state independently from the original IDS source so users can adapt requirements to project stages.

## Repository Structure

```text
backend/        FastAPI app, routers, models, IDS parsing, validation logic
frontend/       React + TypeScript UI
IDS_Sample/     Sample IDS files for testing
IFC_Sample/     Sample IFC files for testing
README.md       Project documentation
```

## Running The Project

### Requirements

- Python 3.11+
- Node.js 18+ recommended
- npm

### First Run

Backend:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:
- `http://localhost:5173`

Backend API docs:
- `http://localhost:8000/docs`

### Database Notes

On startup, the backend ensures the main database schema exists. Alembic is available in the repository if you want to manage database evolution through migrations, but a default local run does not require a separate migration step to get started.

## Typical Demo Flow

If you want to test the app quickly, a good order is:
1. create or open a project,
2. configure disciplines and phases in `Project Setup`,
3. import one or more IDS files in `IDS Import`,
4. assign requirements in `IDS Split/Merge`,
5. open `IDS Compare` to inspect differences,
6. upload an IFC model and validate it in `IFC Validation`,
7. export the curated IDS output in `IDS Export`.

## Sample Data

The repository includes sample assets:
- `IDS_Sample/` contains IDS files,
- `IFC_Sample/` contains IFC models,
- `backend/sample_data/` contains backend-side sample resources used during development.

These samples are useful for local testing and demo recordings.

## API Overview

The backend is organized into feature routers, including:
- `projects`
- `phases`
- `setup`
- `sources`
- `matrix`
- `compare`
- `validation`
- `cell_validation`
- `export`
- `dashboard`
- `translations`

The API is designed around a project-centric model, where most routes are scoped under:

```text
/api/projects/{project_id}/...
```

## Current Focus Of The Application

IDS Stage Gate currently focuses on:
- structured IDS management,
- phase-aware requirement curation,
- IFC validation against curated requirements,
- export of project-specific IDS deliverables.

The application is especially suited for demos, hackathons, and early-stage tooling around BIM information requirements where traceability between source IDS, project stages, and model validation matters.

# IDS Phase Editor

A tool for managing and splitting IFC Information Delivery Specification (IDS) files by project phase.

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate           # Windows (PowerShell)
# source venv/bin/activate      # Linux / macOS
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
# → opens at http://localhost:5173
```

## Features

- **Upload & Parse** — drag-and-drop `.ids` files; extracts specs, requirements, and base optionality
- **Phase Management** — create named, color-coded delivery phases per project
- **Phase Matrix Editor** — set each requirement as `required`, `optional`, or `excluded` per phase; auto-saves with 500ms debounce
- **Compare View** — side-by-side summary cards showing requirement counts per phase
- **Export** — download phase-specific `.ids` files, or all phases as a ZIP archive

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLite (SQLAlchemy + Alembic)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS

## API

Backend runs at `http://localhost:8000`. Interactive docs available at `http://localhost:8000/docs`.

## Sample Files

Sample IDS files are in `backend/sample_data/` for testing.

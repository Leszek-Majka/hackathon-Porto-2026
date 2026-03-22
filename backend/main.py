import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # noqa: F401 — ensure models are registered

from routers import projects, phases, sources, setup as setup_router, matrix, export, validation, dashboard, translations

EXPORTS_DIR = os.path.join(os.path.dirname(__file__), "exports")


def _cleanup_old_exports():
    """Remove generated PDFs older than 24h."""
    if not os.path.exists(EXPORTS_DIR):
        return
    now = time.time()
    for fname in os.listdir(EXPORTS_DIR):
        fpath = os.path.join(EXPORTS_DIR, fname)
        if os.path.isfile(fpath) and now - os.path.getmtime(fpath) > 86400:
            try:
                os.remove(fpath)
            except OSError:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    _cleanup_old_exports()
    yield


app = FastAPI(title="IDS Phase Editor API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(phases.router)
app.include_router(setup_router.router)
app.include_router(sources.router)
app.include_router(matrix.router)
app.include_router(export.router)
app.include_router(validation.router)
app.include_router(dashboard.router)
app.include_router(translations.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # noqa: F401 — ensure models are registered

from routers import projects, phases, matrix, export

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="IDS Phase Editor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(phases.router)
app.include_router(matrix.router)
app.include_router(export.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}

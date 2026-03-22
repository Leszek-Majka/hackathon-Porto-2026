"""Translations and project languages router."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Translation, ProjectLanguage
from schemas import TranslationUpsert, LanguageUpdate
from i18n import SUPPORTED_LANGUAGES

router = APIRouter(prefix="/api/projects", tags=["translations"])

DEFAULT_LANGUAGES = ["en", "pl", "de", "fr", "es", "nl"]


def _ensure_languages(project_id: int, db: Session):
    """Create default language rows if missing."""
    existing = {pl.language_code for pl in db.query(ProjectLanguage).filter(ProjectLanguage.project_id == project_id).all()}
    for code in DEFAULT_LANGUAGES:
        if code not in existing:
            db.add(ProjectLanguage(project_id=project_id, language_code=code, enabled=1 if code == "en" else 0))
    db.commit()


@router.get("/{project_id}/translations", response_model=None)
def get_translations(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    translations = db.query(Translation).filter(Translation.project_id == project_id).all()
    return [
        {
            "id": t.id,
            "project_id": t.project_id,
            "entity_type": t.entity_type,
            "entity_id": t.entity_id,
            "field": t.field,
            "language_code": t.language_code,
            "value": t.value,
            "updated_at": t.updated_at.isoformat(),
        }
        for t in translations
    ]


@router.put("/{project_id}/translations", response_model=None)
def upsert_translation(project_id: int, data: TranslationUpsert, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = db.query(Translation).filter(
        Translation.project_id == project_id,
        Translation.entity_type == data.entity_type,
        Translation.entity_id == data.entity_id,
        Translation.field == data.field,
        Translation.language_code == data.language_code,
    ).first()

    if existing:
        existing.value = data.value
        db.commit()
        t = existing
    else:
        t = Translation(
            project_id=project_id,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            field=data.field,
            language_code=data.language_code,
            value=data.value,
        )
        db.add(t)
        db.commit()
        db.refresh(t)

    return {
        "id": t.id,
        "project_id": t.project_id,
        "entity_type": t.entity_type,
        "entity_id": t.entity_id,
        "field": t.field,
        "language_code": t.language_code,
        "value": t.value,
        "updated_at": t.updated_at.isoformat(),
    }


@router.delete("/{project_id}/translations/{translation_id}")
def delete_translation(project_id: int, translation_id: int, db: Session = Depends(get_db)):
    t = db.query(Translation).filter(
        Translation.id == translation_id, Translation.project_id == project_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Translation not found")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/languages", response_model=None)
def get_languages(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _ensure_languages(project_id, db)
    langs = db.query(ProjectLanguage).filter(ProjectLanguage.project_id == project_id).all()
    return [
        {
            "id": l.id,
            "code": l.language_code,
            "name": SUPPORTED_LANGUAGES.get(l.language_code, l.language_code),
            "enabled": bool(l.enabled),
        }
        for l in langs
    ]


@router.put("/{project_id}/languages", response_model=None)
def update_languages(project_id: int, updates: List[LanguageUpdate], db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _ensure_languages(project_id, db)

    for upd in updates:
        if upd.code == "en":
            continue  # English always enabled
        lang = db.query(ProjectLanguage).filter(
            ProjectLanguage.project_id == project_id,
            ProjectLanguage.language_code == upd.code,
        ).first()
        if lang:
            lang.enabled = 1 if upd.enabled else 0
        else:
            db.add(ProjectLanguage(project_id=project_id, language_code=upd.code, enabled=1 if upd.enabled else 0))
    db.commit()
    langs = db.query(ProjectLanguage).filter(ProjectLanguage.project_id == project_id).all()
    return [
        {
            "id": l.id,
            "code": l.language_code,
            "name": SUPPORTED_LANGUAGES.get(l.language_code, l.language_code),
            "enabled": bool(l.enabled),
        }
        for l in langs
    ]

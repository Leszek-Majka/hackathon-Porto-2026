from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


# Project schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectDetail(ProjectResponse):
    ids_file: Optional["IDSFileResponse"] = None
    phases: List["PhaseResponse"] = []


# IDS File schemas
class IDSFileResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    parsed_json: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


# Phase schemas
class PhaseCreate(BaseModel):
    name: str
    color: Optional[str] = None
    order_index: Optional[int] = 0


class PhaseUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order_index: Optional[int] = None


class PhaseResponse(BaseModel):
    id: int
    project_id: int
    name: str
    color: str
    order_index: int
    created_at: datetime

    class Config:
        from_attributes = True


# Matrix schemas
class MatrixCellUpdate(BaseModel):
    spec_id: str
    requirement_key: str
    phase_id: int
    status: str  # required | optional | excluded


class MatrixEntryResponse(BaseModel):
    id: int
    project_id: int
    spec_id: str
    requirement_key: str
    phase_id: int
    status: str

    class Config:
        from_attributes = True


# IFC File schemas
class IFCFileResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    file_path: str
    ifc_schema: str
    element_count: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


# Validation schemas
class ValidationRunResponse(BaseModel):
    id: int
    project_id: int
    phase_id: int
    ifc_file_id: int
    status: str
    run_at: datetime
    summary_json: str
    results_json: str
    error_message: str

    class Config:
        from_attributes = True


# Translation schemas
class TranslationUpsert(BaseModel):
    entity_type: str   # spec | requirement
    entity_id: str
    field: str         # name | description | instructions | label
    language_code: str
    value: str


class TranslationResponse(BaseModel):
    id: int
    project_id: int
    entity_type: str
    entity_id: str
    field: str
    language_code: str
    value: str
    updated_at: datetime

    class Config:
        from_attributes = True


# Project language schemas
class LanguageUpdate(BaseModel):
    code: str
    enabled: bool


ProjectDetail.model_rebuild()

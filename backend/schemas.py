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
    code: Optional[str] = None
    loin: Optional[int] = None
    gate: Optional[str] = None
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


# Discipline schemas
class DisciplineCreate(BaseModel):
    name: str
    code: str
    color: Optional[str] = "#3b9eff"
    order_index: Optional[int] = 0


class DisciplineUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    color: Optional[str] = None
    order_index: Optional[int] = None


class DisciplineResponse(BaseModel):
    id: int
    project_id: int
    name: str
    code: Optional[str] = None
    abbreviation: Optional[str] = None
    color: str
    order_index: int

    class Config:
        from_attributes = True


# LCA schemas
class LCAEntryCreate(BaseModel):
    phase_id: Optional[int] = None
    discipline_id: Optional[int] = None
    ifc_entity: str = ""
    element_name: str = ""
    quantity_value: float = 0.0
    quantity_unit: str = ""
    material: str = ""
    bsdd_uri: str = ""
    gwp_factor: float = 0.0
    mass_kg: float = 0.0


class LCAEntryResponse(BaseModel):
    id: int
    project_id: int
    phase_id: Optional[int] = None
    discipline_id: Optional[int] = None
    ifc_entity: str
    element_name: str
    quantity_value: float
    quantity_unit: str
    material: str
    bsdd_uri: str
    gwp_factor: float
    mass_kg: float
    gwp_a1a3: float
    gwp_a4a5: Optional[float] = None
    gwp_b1b7: Optional[float] = None
    gwp_c1c4: Optional[float] = None
    gwp_d: Optional[float] = None
    en15978_scope: str
    confidence: str
    flag: str
    stage_check: str = "{}"

    class Config:
        from_attributes = True


class LCASummary(BaseModel):
    ils17_mass_kg: float
    ils18_gwp_a1a3: float
    ils19_wlc_estimate: float
    confidence: str
    loin_level: int
    en15978_stages: Dict[str, Optional[float]]
    by_discipline: List[Dict[str, Any]]
    by_discipline_stages: List[Dict[str, Any]]
    by_riba_phase: List[Dict[str, Any]]
    top_contributor: Optional[Dict[str, Any]] = None


ProjectDetail.model_rebuild()

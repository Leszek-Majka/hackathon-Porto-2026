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
    color: Optional[str] = "#3B82F6"
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


ProjectDetail.model_rebuild()

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ids_file = relationship("IDSFile", back_populates="project", uselist=False, cascade="all, delete-orphan")
    ifc_file = relationship("IFCFile", back_populates="project", uselist=False, cascade="all, delete-orphan")
    phases = relationship("Phase", back_populates="project", cascade="all, delete-orphan", order_by="Phase.order_index")
    matrix_entries = relationship("PhaseMatrix", back_populates="project", cascade="all, delete-orphan")
    validation_runs = relationship("ValidationRun", back_populates="project", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="project", cascade="all, delete-orphan")
    languages = relationship("ProjectLanguage", back_populates="project", cascade="all, delete-orphan")


class IDSFile(Base):
    __tablename__ = "ids_files"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    raw_xml = Column(Text, nullable=False)
    parsed_json = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="ids_file")


class Phase(Base):
    __tablename__ = "phases"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, default="#3B82F6")
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="phases")
    matrix_entries = relationship("PhaseMatrix", back_populates="phase", cascade="all, delete-orphan")
    validation_runs = relationship("ValidationRun", back_populates="phase")


class PhaseMatrix(Base):
    __tablename__ = "phase_matrix"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    spec_id = Column(String, nullable=False)
    requirement_key = Column(String, nullable=False)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    status = Column(String, nullable=False, default="required")  # required | optional | excluded

    project = relationship("Project", back_populates="matrix_entries")
    phase = relationship("Phase", back_populates="matrix_entries")


class IFCFile(Base):
    __tablename__ = "ifc_files"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    ifc_schema = Column(String, default="")
    element_count = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="ifc_file")
    validation_runs = relationship("ValidationRun", back_populates="ifc_file", cascade="all, delete-orphan")


class ValidationRun(Base):
    __tablename__ = "validation_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    ifc_file_id = Column(Integer, ForeignKey("ifc_files.id"), nullable=False)
    status = Column(String, default="pending")  # pending | running | complete | error
    run_at = Column(DateTime(timezone=True), server_default=func.now())
    summary_json = Column(Text, default="{}")
    results_json = Column(Text, default="{}")
    error_message = Column(Text, default="")

    project = relationship("Project", back_populates="validation_runs")
    phase = relationship("Phase", back_populates="validation_runs")
    ifc_file = relationship("IFCFile", back_populates="validation_runs")


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    entity_type = Column(String, nullable=False)   # spec | requirement
    entity_id = Column(String, nullable=False)
    field = Column(String, nullable=False)          # name | description | instructions | label
    language_code = Column(String, nullable=False)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="translations")


class ProjectLanguage(Base):
    __tablename__ = "project_languages"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    language_code = Column(String, nullable=False)
    enabled = Column(Integer, default=1)  # 1 = enabled, 0 = disabled

    project = relationship("Project", back_populates="languages")

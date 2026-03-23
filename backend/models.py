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
    ifc_files = relationship("IFCFile", back_populates="project", cascade="all, delete-orphan", order_by="IFCFile.uploaded_at")
    phases = relationship("Phase", back_populates="project", cascade="all, delete-orphan", order_by="Phase.order_index")
    matrix_entries = relationship("PhaseMatrix", back_populates="project", cascade="all, delete-orphan")
    validation_runs = relationship("ValidationRun", back_populates="project", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="project", cascade="all, delete-orphan")
    languages = relationship("ProjectLanguage", back_populates="project", cascade="all, delete-orphan")
    disciplines = relationship("Discipline", back_populates="project", cascade="all, delete-orphan", order_by="Discipline.order_index")
    sources = relationship("IDSSource", back_populates="project", cascade="all, delete-orphan")
    matrix_cells = relationship("MatrixCell", back_populates="project", cascade="all, delete-orphan")
    cell_validations = relationship("CellValidation", back_populates="project", cascade="all, delete-orphan")


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
    matrix_cells = relationship("MatrixCell", back_populates="phase", cascade="all, delete-orphan")
    cell_validations = relationship("CellValidation", back_populates="phase")


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

    project = relationship("Project", back_populates="ifc_files")
    validation_runs = relationship("ValidationRun", back_populates="ifc_file", cascade="all, delete-orphan")
    cell_validations = relationship("CellValidation", back_populates="ifc_file", cascade="all, delete-orphan")


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


class Discipline(Base):
    __tablename__ = "disciplines"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    abbreviation = Column(String, default="")
    color = Column(String, default="#6366F1")
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="disciplines")
    matrix_cells = relationship("MatrixCell", back_populates="discipline", cascade="all, delete-orphan")
    cell_validations = relationship("CellValidation", back_populates="discipline")


class IDSSource(Base):
    __tablename__ = "ids_sources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    title = Column(String, default="")
    author = Column(String, default="")
    date = Column(String, default="")
    version = Column(String, default="")
    raw_xml = Column(Text, nullable=False)
    parsed_json = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="sources")
    cell_entries = relationship("CellEntry", back_populates="source_ids", cascade="all, delete-orphan")


class MatrixCell(Base):
    __tablename__ = "matrix_cells"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    header_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="matrix_cells")
    discipline = relationship("Discipline", back_populates="matrix_cells")
    phase = relationship("Phase", back_populates="matrix_cells")
    entries = relationship("CellEntry", back_populates="cell", cascade="all, delete-orphan", order_by="CellEntry.order_index")


class CellEntry(Base):
    __tablename__ = "cell_entries"

    id = Column(Integer, primary_key=True, index=True)
    cell_id = Column(Integer, ForeignKey("matrix_cells.id"), nullable=False)
    source_ids_id = Column(Integer, ForeignKey("ids_sources.id"), nullable=True)
    entry_type = Column(String, nullable=False)  # specification|applicability|requirement
    spec_name = Column(String, default="")
    applicability_json = Column(Text, default="[]")
    requirement_json = Column(Text, default="{}")
    status = Column(String, default="required")  # required|optional|prohibited
    group_key = Column(String, nullable=False)  # UUID
    group_type = Column(String, default="standalone")  # specification|applicability|standalone
    order_index = Column(Integer, default=0)
    spec_meta_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cell = relationship("MatrixCell", back_populates="entries")
    source_ids = relationship("IDSSource", back_populates="cell_entries")


class CellValidation(Base):
    __tablename__ = "cell_validations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    ifc_file_id = Column(Integer, ForeignKey("ifc_files.id"), nullable=False)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    status = Column(String, default="pending")  # pending|running|complete|error
    run_at = Column(DateTime(timezone=True), server_default=func.now())
    summary_json = Column(Text, default="{}")
    results_json = Column(Text, default="[]")
    error_message = Column(Text, default="")

    project = relationship("Project", back_populates="cell_validations")
    ifc_file = relationship("IFCFile", back_populates="cell_validations")
    discipline = relationship("Discipline", back_populates="cell_validations")
    phase = relationship("Phase", back_populates="cell_validations")

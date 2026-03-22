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
    phases = relationship("Phase", back_populates="project", cascade="all, delete-orphan", order_by="Phase.order_index")
    matrix_entries = relationship("PhaseMatrix", back_populates="project", cascade="all, delete-orphan")


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

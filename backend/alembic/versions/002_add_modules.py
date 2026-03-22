"""Add IFC, Validation, Translation, ProjectLanguage tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ifc_files",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("filename", sa.String, nullable=False),
        sa.Column("file_path", sa.String, nullable=False),
        sa.Column("ifc_schema", sa.String, default=""),
        sa.Column("element_count", sa.Integer, default=0),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "validation_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("phase_id", sa.Integer, sa.ForeignKey("phases.id"), nullable=False),
        sa.Column("ifc_file_id", sa.Integer, sa.ForeignKey("ifc_files.id"), nullable=False),
        sa.Column("status", sa.String, default="pending"),
        sa.Column("run_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("summary_json", sa.Text, default="{}"),
        sa.Column("results_json", sa.Text, default="{}"),
        sa.Column("error_message", sa.Text, default=""),
    )
    op.create_table(
        "translations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("entity_type", sa.String, nullable=False),
        sa.Column("entity_id", sa.String, nullable=False),
        sa.Column("field", sa.String, nullable=False),
        sa.Column("language_code", sa.String, nullable=False),
        sa.Column("value", sa.Text, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "project_languages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("language_code", sa.String, nullable=False),
        sa.Column("enabled", sa.Integer, default=1),
    )


def downgrade() -> None:
    op.drop_table("project_languages")
    op.drop_table("translations")
    op.drop_table("validation_runs")
    op.drop_table("ifc_files")

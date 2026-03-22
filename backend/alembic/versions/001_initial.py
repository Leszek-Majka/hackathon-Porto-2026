"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text, default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "ids_files",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("filename", sa.String, nullable=False),
        sa.Column("raw_xml", sa.Text, nullable=False),
        sa.Column("parsed_json", sa.Text, nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "phases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("color", sa.String, default="#3B82F6"),
        sa.Column("order_index", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "phase_matrix",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("spec_id", sa.String, nullable=False),
        sa.Column("requirement_key", sa.String, nullable=False),
        sa.Column("phase_id", sa.Integer, sa.ForeignKey("phases.id"), nullable=False),
        sa.Column("status", sa.String, nullable=False, default="required"),
    )


def downgrade() -> None:
    op.drop_table("phase_matrix")
    op.drop_table("phases")
    op.drop_table("ids_files")
    op.drop_table("projects")

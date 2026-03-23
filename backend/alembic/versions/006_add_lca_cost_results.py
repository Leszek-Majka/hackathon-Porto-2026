"""Add lca_cost_results table

Revision ID: 006
Revises: 005
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lca_cost_results",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("ifc_file_id", sa.Integer, sa.ForeignKey("ifc_files.id"), nullable=True),
        sa.Column("params_json", sa.Text, server_default="{}"),
        sa.Column("assemblies_json", sa.Text, server_default="[]"),
        sa.Column("projections_json", sa.Text, server_default="[]"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("lca_cost_results")

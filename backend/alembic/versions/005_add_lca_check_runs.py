"""Add lca_check_runs table

Revision ID: 005
Revises: 004
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lca_check_runs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("phase_id", sa.Integer, sa.ForeignKey("phases.id"), nullable=False),
        sa.Column("run_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String, default="complete"),
        sa.Column("total_elements", sa.Integer, default=0),
        sa.Column("pass_count", sa.Integer, default=0),
        sa.Column("warn_count", sa.Integer, default=0),
        sa.Column("fail_count", sa.Integer, default=0),
        sa.Column("skip_count", sa.Integer, default=0),
        sa.Column("total_gwp_a1a3", sa.Float, default=0.0),
        sa.Column("total_gwp_wlc", sa.Float, default=0.0),
        sa.Column("total_mass_kg", sa.Float, default=0.0),
        sa.Column("loin_level", sa.Integer, default=2),
        sa.Column("confidence", sa.String, default="order_of_magnitude"),
        sa.Column("results_json", sa.Text, default="{}"),
    )


def downgrade() -> None:
    op.drop_table("lca_check_runs")

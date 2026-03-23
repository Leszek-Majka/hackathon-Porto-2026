"""Add created_at to disciplines table

Revision ID: 004
Revises: 003
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All other columns/tables already exist from previous migrations.
    # Only created_at on disciplines is missing.
    op.add_column("disciplines", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("disciplines", "created_at")

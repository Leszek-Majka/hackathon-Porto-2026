"""Add cell_validations table and support multiple IFC files.

Revision ID: 005
Revises: 004
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'cell_validations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('ifc_file_id', sa.Integer(), sa.ForeignKey('ifc_files.id'), nullable=False),
        sa.Column('discipline_id', sa.Integer(), sa.ForeignKey('disciplines.id'), nullable=False),
        sa.Column('phase_id', sa.Integer(), sa.ForeignKey('phases.id'), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('run_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('summary_json', sa.Text(), nullable=True),
        sa.Column('results_json', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_cell_validations_id'), 'cell_validations', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_cell_validations_id'), table_name='cell_validations')
    op.drop_table('cell_validations')

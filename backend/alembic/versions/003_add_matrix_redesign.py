"""Add disciplines, ids_sources, matrix_cells, cell_entries tables"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('disciplines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('abbreviation', sa.String(), default=''),
        sa.Column('color', sa.String(), default='#6366F1'),
        sa.Column('order_index', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('ids_sources',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('title', sa.String(), default=''),
        sa.Column('author', sa.String(), default=''),
        sa.Column('date', sa.String(), default=''),
        sa.Column('version', sa.String(), default=''),
        sa.Column('raw_xml', sa.Text(), nullable=False),
        sa.Column('parsed_json', sa.Text(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('matrix_cells',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('discipline_id', sa.Integer(), sa.ForeignKey('disciplines.id'), nullable=False),
        sa.Column('phase_id', sa.Integer(), sa.ForeignKey('phases.id'), nullable=False),
        sa.Column('header_json', sa.Text(), default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('cell_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('cell_id', sa.Integer(), sa.ForeignKey('matrix_cells.id'), nullable=False),
        sa.Column('source_ids_id', sa.Integer(), sa.ForeignKey('ids_sources.id'), nullable=True),
        sa.Column('entry_type', sa.String(), nullable=False),
        sa.Column('spec_name', sa.String(), default=''),
        sa.Column('applicability_json', sa.Text(), default='[]'),
        sa.Column('requirement_json', sa.Text(), default='{}'),
        sa.Column('status', sa.String(), default='required'),
        sa.Column('group_key', sa.String(), nullable=False),
        sa.Column('group_type', sa.String(), default='standalone'),
        sa.Column('order_index', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('cell_entries')
    op.drop_table('matrix_cells')
    op.drop_table('ids_sources')
    op.drop_table('disciplines')

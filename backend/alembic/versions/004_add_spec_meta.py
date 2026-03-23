"""Add spec_meta_json to cell_entries"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cell_entries', sa.Column('spec_meta_json', sa.Text(), server_default='{}'))


def downgrade():
    op.drop_column('cell_entries', 'spec_meta_json')

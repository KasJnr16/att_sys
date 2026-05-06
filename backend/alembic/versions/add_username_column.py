"""Add username to user table

Revision ID: add_username_column
Revises: f34a28ee7b08
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_username_column'
down_revision = 'f34a28ee7b08'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('user', sa.Column('username', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('user', 'username')

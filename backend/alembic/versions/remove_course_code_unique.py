"""Remove unique constraint from course_code

Revision ID: remove_course_code_unique
Revises: make_course_code_nullable
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'remove_course_code_unique'
down_revision = 'make_course_code_nullable'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.drop_index('ix_course_course_code', table_name='course')
    op.create_index('ix_course_course_code', table_name='course', columns=['course_code'], unique=False, if_not_exists=True)

def downgrade() -> None:
    op.drop_index('ix_course_course_code', table_name='course')
    op.create_index('ix_course_course_code', table_name='course', columns=['course_code'], unique=True, if_not_exists=True)

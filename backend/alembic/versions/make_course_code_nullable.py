"""Make course_code nullable in course table

Revision ID: make_course_code_nullable
Revises: add_username_column
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'make_course_code_nullable'
down_revision = 'add_username_column'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.alter_column('course', 'course_code', nullable=True)

def downgrade() -> None:
    op.alter_column('course', 'course_code', nullable=False)

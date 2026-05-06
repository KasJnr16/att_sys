"""Add verification_code to attendance_session

Revision ID: abc123add_verification_code
Revises: xyz789remove_student_unique
Create Date: 2026-04-05 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'abc123add_verification_code'
down_revision = 'xyz789remove_student_unique'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('attendance_session', sa.Column('verification_code', sa.String(6), nullable=True))


def downgrade() -> None:
    op.drop_column('attendance_session', 'verification_code')

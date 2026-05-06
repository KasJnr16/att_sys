"""add student_id to webauthn tables

Revision ID: def456ghi789
Revises: abc123def456
Create Date: 2026-04-05 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'def456ghi789'
down_revision: Union[str, Sequence[str], None] = 'abc123def456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('webauthn_credential', sa.Column('student_id', sa.Integer(), sa.ForeignKey('student.id'), nullable=True, unique=True))
    op.add_column('webauthn_challenge', sa.Column('student_id', sa.Integer(), sa.ForeignKey('student.id'), nullable=True))
    op.alter_column('webauthn_challenge', 'user_id', nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('webauthn_challenge', 'student_id')
    op.drop_column('webauthn_credential', 'student_id')
    op.alter_column('webauthn_challenge', 'user_id', nullable=False)

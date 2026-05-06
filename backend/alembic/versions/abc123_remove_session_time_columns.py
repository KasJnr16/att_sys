"""remove session time columns

Revision ID: abc123def456
Revises: d9e745bd278c
Create Date: 2026-04-05 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abc123def456'
down_revision: Union[str, Sequence[str], None] = 'd9e745bd278c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('class_session', 'session_start_at')
    op.drop_column('class_session', 'session_end_at')
    op.drop_column('class_session', 'attendance_window_minutes')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('class_session', sa.Column('session_start_at', sa.Time(), nullable=False))
    op.add_column('class_session', sa.Column('session_end_at', sa.Time(), nullable=False))
    op.add_column('class_session', sa.Column('attendance_window_minutes', sa.Integer(), nullable=True))

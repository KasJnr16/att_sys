"""replace face path storage with embedding template

Revision ID: h7c8d9e0f1g2
Revises: g6b7c8d9e0f1
Create Date: 2026-05-15
"""

from typing import Sequence, Union

from alembic import op


revision: str = "h7c8d9e0f1g2"
down_revision: Union[str, Sequence[str], None] = "g6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE student ADD COLUMN IF NOT EXISTS face_embedding JSON")
    op.execute("ALTER TABLE student ADD COLUMN IF NOT EXISTS face_embedding_model VARCHAR")
    op.execute("ALTER TABLE student ADD COLUMN IF NOT EXISTS face_embedding_dimensions INTEGER")
    op.execute("ALTER TABLE student DROP COLUMN IF EXISTS face_reference_path")


def downgrade() -> None:
    op.execute("ALTER TABLE student ADD COLUMN IF NOT EXISTS face_reference_path VARCHAR")
    op.execute("ALTER TABLE student DROP COLUMN IF EXISTS face_embedding_dimensions")
    op.execute("ALTER TABLE student DROP COLUMN IF EXISTS face_embedding_model")
    op.execute("ALTER TABLE student DROP COLUMN IF EXISTS face_embedding")

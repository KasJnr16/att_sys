"""add face recognition fields

Revision ID: g6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g6b7c8d9e0f1"
down_revision: Union[str, Sequence[str], None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("student", sa.Column("face_embedding", sa.JSON(), nullable=True))
    op.add_column("student", sa.Column("face_embedding_model", sa.String(), nullable=True))
    op.add_column("student", sa.Column("face_embedding_dimensions", sa.Integer(), nullable=True))
    op.add_column("student", sa.Column("face_enrolled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("attendance_record", sa.Column("face_verified", sa.Boolean(), nullable=True))
    op.add_column("attendance_record", sa.Column("face_distance", sa.Float(), nullable=True))
    op.add_column("attendance_record", sa.Column("face_threshold", sa.Float(), nullable=True))
    op.add_column("attendance_record", sa.Column("face_confidence", sa.Float(), nullable=True))
    op.add_column("attendance_record", sa.Column("face_model", sa.String(), nullable=True))
    op.add_column("attendance_record", sa.Column("face_antispoof_passed", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_record", "face_antispoof_passed")
    op.drop_column("attendance_record", "face_model")
    op.drop_column("attendance_record", "face_confidence")
    op.drop_column("attendance_record", "face_threshold")
    op.drop_column("attendance_record", "face_distance")
    op.drop_column("attendance_record", "face_verified")
    op.drop_column("student", "face_enrolled_at")
    op.drop_column("student", "face_embedding_dimensions")
    op.drop_column("student", "face_embedding_model")
    op.drop_column("student", "face_embedding")

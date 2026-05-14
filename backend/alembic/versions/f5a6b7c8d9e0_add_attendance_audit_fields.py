"""add attendance audit fields

Revision ID: f5a6b7c8d9e0
Revises: e2f3a4b5c6d7
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE verificationmethod ADD VALUE IF NOT EXISTS 'session_code'")
    op.add_column("attendance_record", sa.Column("client_fingerprint", sa.String(length=64), nullable=True))
    op.add_column("attendance_record", sa.Column("attendance_latitude", sa.Float(), nullable=True))
    op.add_column("attendance_record", sa.Column("attendance_longitude", sa.Float(), nullable=True))
    op.add_column("attendance_record", sa.Column("distance_meters", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_attendance_record_client_fingerprint"),
        "attendance_record",
        ["client_fingerprint"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_attendance_record_client_fingerprint"), table_name="attendance_record")
    op.drop_column("attendance_record", "distance_meters")
    op.drop_column("attendance_record", "attendance_longitude")
    op.drop_column("attendance_record", "attendance_latitude")
    op.drop_column("attendance_record", "client_fingerprint")

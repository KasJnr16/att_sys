"""add attendance code attempts and session freeze lock

Revision ID: b1c2d3e4f5a6
Revises: 674959737f7c
Create Date: 2026-04-07 02:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "674959737f7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendance_session",
        sa.Column("code_verification_locked_until", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "attendance_code_attempt",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attendance_session_id", sa.Integer(), nullable=False),
        sa.Column("client_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("code_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["attendance_session_id"], ["attendance_session.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attendance_session_id", "client_fingerprint", name="_attendance_session_client_fingerprint_uc"),
    )
    op.create_index(op.f("ix_attendance_code_attempt_id"), "attendance_code_attempt", ["id"], unique=False)
    op.create_index(op.f("ix_attendance_code_attempt_attendance_session_id"), "attendance_code_attempt", ["attendance_session_id"], unique=False)
    op.create_index(op.f("ix_attendance_code_attempt_client_fingerprint"), "attendance_code_attempt", ["client_fingerprint"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_attendance_code_attempt_client_fingerprint"), table_name="attendance_code_attempt")
    op.drop_index(op.f("ix_attendance_code_attempt_attendance_session_id"), table_name="attendance_code_attempt")
    op.drop_index(op.f("ix_attendance_code_attempt_id"), table_name="attendance_code_attempt")
    op.drop_table("attendance_code_attempt")
    op.drop_column("attendance_session", "code_verification_locked_until")

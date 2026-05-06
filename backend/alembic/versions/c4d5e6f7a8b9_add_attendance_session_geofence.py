"""add attendance session geofence

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-04-08 10:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attendance_session", sa.Column("generated_latitude", sa.Float(), nullable=True))
    op.add_column("attendance_session", sa.Column("generated_longitude", sa.Float(), nullable=True))
    op.add_column(
        "attendance_session",
        sa.Column("attendance_radius_meters", sa.Integer(), nullable=False, server_default="50"),
    )


def downgrade() -> None:
    op.drop_column("attendance_session", "attendance_radius_meters")
    op.drop_column("attendance_session", "generated_longitude")
    op.drop_column("attendance_session", "generated_latitude")

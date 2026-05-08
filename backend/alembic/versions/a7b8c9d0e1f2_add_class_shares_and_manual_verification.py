"""add class shares and manual verification

Revision ID: a7b8c9d0e1f2
Revises: c4d5e6f7a8b9
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE verificationmethod ADD VALUE IF NOT EXISTS 'manual'")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sharepermission') THEN
                CREATE TYPE sharepermission AS ENUM ('view', 'edit');
            END IF;
        END
        $$;
        """
    )

    share_permission = postgresql.ENUM("view", "edit", name="sharepermission", create_type=False)

    op.create_table(
        "class_share",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("lecturer_id", sa.Integer(), nullable=False),
        sa.Column("permission", share_permission, nullable=False),
        sa.Column("shared_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["class_id"], ["class.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lecturer_id"], ["lecturer.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shared_by_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "lecturer_id", name="_class_share_lecturer_uc"),
    )
    op.create_index(op.f("ix_class_share_id"), "class_share", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_class_share_id"), table_name="class_share")
    op.drop_table("class_share")
    op.execute("DROP TYPE IF EXISTS sharepermission")

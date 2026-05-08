"""add auth email tokens

Revision ID: e2f3a4b5c6d7
Revises: a7b8c9d0e1f2
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    auth_token_purpose = postgresql.ENUM(
        "email_verification",
        "password_reset",
        name="authtokenpurpose",
        create_type=False,
    )
    auth_token_purpose.create(op.get_bind(), checkfirst=True)

    op.add_column("user", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "auth_token",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("purpose", auth_token_purpose, nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_token_id"), "auth_token", ["id"], unique=False)
    op.create_index(op.f("ix_auth_token_user_id"), "auth_token", ["user_id"], unique=False)
    op.create_index(op.f("ix_auth_token_purpose"), "auth_token", ["purpose"], unique=False)
    op.create_index(op.f("ix_auth_token_token_hash"), "auth_token", ["token_hash"], unique=True)
    op.create_index(op.f("ix_auth_token_code_hash"), "auth_token", ["code_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_token_code_hash"), table_name="auth_token")
    op.drop_index(op.f("ix_auth_token_token_hash"), table_name="auth_token")
    op.drop_index(op.f("ix_auth_token_purpose"), table_name="auth_token")
    op.drop_index(op.f("ix_auth_token_user_id"), table_name="auth_token")
    op.drop_index(op.f("ix_auth_token_id"), table_name="auth_token")
    op.drop_table("auth_token")
    op.drop_column("user", "email_verified_at")
    sa.Enum(name="authtokenpurpose").drop(op.get_bind(), checkfirst=True)

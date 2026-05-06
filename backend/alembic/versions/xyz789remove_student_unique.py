"""Remove unique constraint from webauthn_credential student_id

Revision ID: xyz789remove_student_unique
Revises: def456_add_student_to_webauthn
Create Date: 2026-04-05 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'xyz789remove_student_unique'
down_revision = 'def456ghi789'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_webauthn_credential_student_id', 'webauthn_credential', ['student_id'], unique=False, postgresql_where=sa.text('student_id IS NOT NULL'))


def downgrade() -> None:
    op.drop_index('ix_webauthn_credential_student_id', table_name='webauthn_credential')
    op.create_index('ix_webauthn_credential_student_id', 'webauthn_credential', ['student_id'], unique=True, postgresql_where=sa.text('student_id IS NOT NULL'))

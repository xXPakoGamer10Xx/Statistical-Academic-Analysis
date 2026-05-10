"""fix upload_job status column length

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "upload_jobs",
        "status",
        existing_type=sa.String(20),
        type_=sa.String(30),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "upload_jobs",
        "status",
        existing_type=sa.String(30),
        type_=sa.String(20),
        existing_nullable=False,
    )

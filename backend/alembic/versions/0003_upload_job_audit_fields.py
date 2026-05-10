"""add audit fields to upload jobs

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-01
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "upload_jobs",
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "upload_jobs",
        sa.Column("file_sha256", sa.String(length=64), nullable=False, server_default=""),
    )
    op.alter_column("upload_jobs", "file_size_bytes", server_default=None)
    op.alter_column("upload_jobs", "file_sha256", server_default=None)


def downgrade() -> None:
    op.drop_column("upload_jobs", "file_sha256")
    op.drop_column("upload_jobs", "file_size_bytes")

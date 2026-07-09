"""rename evaluacion_docente.docente_id to puesto (P.A. / P.C.)

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-08

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("evaluacion_docente", "docente_id", new_column_name="puesto")


def downgrade() -> None:
    op.alter_column("evaluacion_docente", "puesto", new_column_name="docente_id")

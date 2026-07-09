"""make titulacion.matricula_generacional and concluyeron_estudios nullable

Ya no se capturan desde el formulario manual ni CSV (dataset_definitions.py); se
quitan las restricciones NOT NULL para no romper la carga de filas nuevas. Los
valores historicos ya cargados no se modifican.

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-09

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("titulacion", "matricula_generacional", existing_type=sa.Integer(), nullable=True)
    op.alter_column("titulacion", "concluyeron_estudios", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("titulacion", "matricula_generacional", existing_type=sa.Integer(), nullable=False)
    op.alter_column("titulacion", "concluyeron_estudios", existing_type=sa.Integer(), nullable=False)

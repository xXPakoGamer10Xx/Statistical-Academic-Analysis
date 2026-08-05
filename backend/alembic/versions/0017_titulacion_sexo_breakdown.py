"""add sexo breakdown columns to titulacion

Permite guardar el desglose por sexo (hombres/mujeres) de egresados y titulados,
disponible solo en el historico detallado por cohorte (ETL de datos historicos).
No se captura desde el formulario/CSV estandar (que solo pide totales), por lo que
las 4 columnas quedan nullable.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-05

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | Sequence[str] | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("titulacion", sa.Column("egresados_hombres", sa.Integer(), nullable=True))
    op.add_column("titulacion", sa.Column("egresados_mujeres", sa.Integer(), nullable=True))
    op.add_column("titulacion", sa.Column("titulados_hombres", sa.Integer(), nullable=True))
    op.add_column("titulacion", sa.Column("titulados_mujeres", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("titulacion", "titulados_mujeres")
    op.drop_column("titulacion", "titulados_hombres")
    op.drop_column("titulacion", "egresados_mujeres")
    op.drop_column("titulacion", "egresados_hombres")

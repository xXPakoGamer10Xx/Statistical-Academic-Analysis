"""add ingreso_examen, ingreso_pase_directo, ingreso_renoes to matricula

Desglosa el nuevo ingreso por tipo de admision (Examen / Pase Directo / RENOES).
``nuevo_ingreso`` deja de capturarse directamente y pasa a calcularse como la
suma de estas 3 columnas al momento de la carga; se mantiene la columna para
no perder los valores historicos ya capturados. Filas historicas quedan con
las 3 columnas nuevas en 0 (server_default), sin backfill posible ya que el
desglose no existia antes de este cambio.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-04

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "matricula",
        sa.Column("ingreso_examen", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "matricula",
        sa.Column("ingreso_pase_directo", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "matricula",
        sa.Column("ingreso_renoes", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("matricula", "ingreso_renoes")
    op.drop_column("matricula", "ingreso_pase_directo")
    op.drop_column("matricula", "ingreso_examen")

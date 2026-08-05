"""add ingreso_uaem_gem to matricula

Cuarto tipo de admision de nuevo ingreso (junto a Examen, Pase Directo y RENOES),
confirmado contra el historico institucional (hoja "Examen Admision"): cada ciclo
reporta Examen + RENOES (antes "Hagamoslo Juntos") + UAEM-GEM + Pase Directo = Total.
nuevo_ingreso pasa a calcularse como la suma de los 4. Filas historicas quedan con
este campo en 0 (server_default), sin backfill posible ya que el desglose por UAEM-GEM
no se capturaba antes de este cambio.

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-05

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "matricula",
        sa.Column("ingreso_uaem_gem", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("matricula", "ingreso_uaem_gem")

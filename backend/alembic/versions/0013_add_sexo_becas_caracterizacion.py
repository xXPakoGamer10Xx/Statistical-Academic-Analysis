"""add sexo column to becas and caracterizacion, extend unique constraints

Permite desglosar becas/discapacidad/etnia por sexo (Hombre/Mujer): una misma
combinacion ciclo+programa+tipo ahora puede tener una fila por sexo. Columna
nullable: las filas historicas no tienen este dato y no se modifican.

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-09

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | Sequence[str] | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("becas", sa.Column("sexo", sa.String(10), nullable=True))
    op.drop_constraint("uq_beca", "becas", type_="unique")
    op.create_unique_constraint(
        "uq_beca",
        "becas",
        ["subsistema_id", "ciclo_escolar", "programa_educativo", "tipo", "sexo"],
    )

    op.add_column("caracterizacion", sa.Column("sexo", sa.String(10), nullable=True))
    op.drop_constraint("uq_caracterizacion", "caracterizacion", type_="unique")
    op.create_unique_constraint(
        "uq_caracterizacion",
        "caracterizacion",
        ["subsistema_id", "ciclo_escolar", "programa_educativo", "categoria", "tipo", "sexo"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_caracterizacion", "caracterizacion", type_="unique")
    op.create_unique_constraint(
        "uq_caracterizacion",
        "caracterizacion",
        ["subsistema_id", "ciclo_escolar", "programa_educativo", "categoria", "tipo"],
    )
    op.drop_column("caracterizacion", "sexo")

    op.drop_constraint("uq_beca", "becas", type_="unique")
    op.create_unique_constraint(
        "uq_beca",
        "becas",
        ["subsistema_id", "ciclo_escolar", "programa_educativo", "tipo"],
    )
    op.drop_column("becas", "sexo")

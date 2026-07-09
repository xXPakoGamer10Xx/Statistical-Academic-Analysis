"""add ciclos_generacionales catalog (ciclo escolar + generacion unificados)

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-08

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CICLOS = [f"{y}-{y + 1}" for y in range(2019, 2031)]  # 2019-2020 .. 2030-2031
GENERACIONES = ["2020-2023", "2021-2024", "2022-2025"]


def upgrade() -> None:
    op.create_table(
        "ciclos_generacionales",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("valor", sa.String(9), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False, index=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("valor", "tipo", name="uq_ciclo_generacional_valor_tipo"),
    )

    ciclos_table = sa.table(
        "ciclos_generacionales",
        sa.column("valor", sa.String),
        sa.column("tipo", sa.String),
    )
    op.bulk_insert(
        ciclos_table,
        [{"valor": v, "tipo": "ciclo"} for v in CICLOS]
        + [{"valor": v, "tipo": "generacion"} for v in GENERACIONES],
    )


def downgrade() -> None:
    op.drop_table("ciclos_generacionales")

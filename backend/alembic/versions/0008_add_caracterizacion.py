"""add caracterizacion table (desglose por beca / discapacidad / etnia)

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-17

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "caracterizacion",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("ciclo_escolar", sa.String(20), nullable=False, index=True),
        sa.Column("programa_educativo", sa.String(150), nullable=False, index=True),
        sa.Column("categoria", sa.String(20), nullable=False, index=True),
        sa.Column("tipo", sa.String(100), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "subsistema_id",
            "ciclo_escolar",
            "programa_educativo",
            "categoria",
            "tipo",
            name="uq_caracterizacion",
        ),
    )


def downgrade() -> None:
    op.drop_table("caracterizacion")

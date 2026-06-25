"""add becas table and migrate existing beca rows from caracterizacion

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-24

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "becas",
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
        sa.Column("tipo", sa.String(100), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "subsistema_id",
            "ciclo_escolar",
            "programa_educativo",
            "tipo",
            name="uq_beca",
        ),
    )

    op.execute(
        """
        INSERT INTO becas (subsistema_id, ciclo_escolar, programa_educativo, tipo, cantidad, uploaded_at)
        SELECT subsistema_id, ciclo_escolar, programa_educativo, tipo, cantidad, uploaded_at
        FROM caracterizacion
        WHERE categoria = 'beca'
        ON CONFLICT ON CONSTRAINT uq_beca DO NOTHING
        """
    )

    op.execute("DELETE FROM caracterizacion WHERE categoria = 'beca'")


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO caracterizacion (
            subsistema_id, ciclo_escolar, programa_educativo, categoria, tipo, cantidad, uploaded_at
        )
        SELECT subsistema_id, ciclo_escolar, programa_educativo, 'beca', tipo, cantidad, uploaded_at
        FROM becas
        ON CONFLICT ON CONSTRAINT uq_caracterizacion DO NOTHING
        """
    )
    op.drop_table("becas")
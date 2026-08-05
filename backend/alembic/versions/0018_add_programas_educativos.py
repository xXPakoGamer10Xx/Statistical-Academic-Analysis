"""add programas_educativos catalog (carreras + TSU emparejadas)

Catalogo administrable de carreras por subsistema, con nivel (tsu | profesional) y un
enlace opcional a su carrera par (TSU <-> Ingenieria/Licenciatura relacionada). Antes de
este catalogo, "programa_educativo" era solo una cadena libre replicada en cada tabla de
datos, sin catalogo propio ni forma de registrar la relacion TSU <-> carrera.

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-05

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | Sequence[str] | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "programas_educativos",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("subsistema_id", sa.Integer(), nullable=False, index=True),
        sa.Column("nombre", sa.String(150), nullable=False, index=True),
        sa.Column("nivel", sa.String(20), nullable=False),
        sa.Column("carrera_par_id", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["subsistema_id"], ["subsistemas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["carrera_par_id"], ["programas_educativos.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("subsistema_id", "nombre", name="uq_programa_educativo_subsistema_nombre"),
    )


def downgrade() -> None:
    op.drop_table("programas_educativos")

"""rename existing evaluacion_docente puesto P.C. to P.T.C.

El catalogo de puesto en evaluacion_docente cambia de P.A./P.C. a P.A./P.T.C.
(Profesor de Tiempo Completo). Se actualizan las filas historicas para que
sigan siendo validas contra el nuevo catalogo.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-10

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE evaluacion_docente SET puesto = 'P.T.C.' WHERE puesto = 'P.C.'")


def downgrade() -> None:
    op.execute("UPDATE evaluacion_docente SET puesto = 'P.C.' WHERE puesto = 'P.T.C.'")

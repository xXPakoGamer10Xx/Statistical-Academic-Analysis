"""rename matricula.poblacion_edad_escolar to otros_ingresos

"poblacion_edad_escolar" (denominador del indicador Cobertura, un dato demografico sin
relacion con la matricula) se repurpone como "otros_ingresos": alumnos que se suman
directo a la Matricula Actual (ver calculate_matricula_actual), fuera de las categorias
de Nuevo Ingreso. Ambos conceptos son incompatibles -- un valor capturado bajo el
significado anterior (poblacion en edad escolar, tipicamente miles de personas) inflaria
brutalmente la matricula si se sumara tal cual bajo el significado nuevo -- asi que
cualquier valor existente se resetea a NULL en vez de conservarse. El indicador Cobertura
(que dependia de esta columna) se elimina.

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-05

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0019"
down_revision: str | Sequence[str] | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("matricula", "poblacion_edad_escolar", new_column_name="otros_ingresos")
    op.execute("UPDATE matricula SET otros_ingresos = NULL")


def downgrade() -> None:
    op.execute("UPDATE matricula SET otros_ingresos = NULL")
    op.alter_column("matricula", "otros_ingresos", new_column_name="poblacion_edad_escolar")

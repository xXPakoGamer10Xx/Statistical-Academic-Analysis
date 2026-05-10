"""seed subsistemas

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-01

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SUBSISTEMAS = [
    ("Tecnológicos de Estudios Superiores", "TECNOLOGICOS_SUPERIORES"),
    ("Universidades Estatales", "ESTATALES"),
    ("Universidades Interculturales", "INTERCULTURALES"),
    ("Universidades Tecnológicas", "TECNOLOGICAS"),
    ("Universidades Politécnicas", "POLITECNICAS"),
    ("Escuelas Normales", "NORMALES"),
    ("Universidades Particulares", "PARTICULARES"),
]


def upgrade() -> None:
    for nombre, codigo in SUBSISTEMAS:
        op.execute(
            f"INSERT INTO subsistemas (nombre, codigo) VALUES ('{nombre}', '{codigo}') "
            f"ON CONFLICT (codigo) DO NOTHING"
        )


def downgrade() -> None:
    codigos = ",".join(f"'{c}'" for _, c in SUBSISTEMAS)
    op.execute(f"DELETE FROM subsistemas WHERE codigo IN ({codigos})")

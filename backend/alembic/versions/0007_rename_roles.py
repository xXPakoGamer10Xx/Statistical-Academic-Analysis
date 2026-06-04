"""rename roles to viewer / admin_escolar / admin_general

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-03

Mapeo:
    usuario   -> viewer        (solo consulta; no sube ni exporta)
    admin     -> admin_escolar (sube/gestiona su escuela)
    directivo -> admin_general (ve todas las escuelas)
"""
from __future__ import annotations

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET role = 'admin_general' WHERE role = 'directivo'")
    op.execute("UPDATE users SET role = 'admin_escolar' WHERE role = 'admin'")
    op.execute("UPDATE users SET role = 'viewer' WHERE role = 'usuario'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'directivo' WHERE role = 'admin_general'")
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'admin_escolar'")
    op.execute("UPDATE users SET role = 'usuario' WHERE role = 'viewer'")

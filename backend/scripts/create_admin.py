"""Crea el usuario administrador inicial si no existe."""
import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User


async def main() -> int:
    if not settings.INITIAL_ADMIN_PASSWORD:
        print("[create_admin] INITIAL_ADMIN_PASSWORD no está configurado. Saltando.")
        return 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.INITIAL_ADMIN_EMAIL.lower()))
        existing = result.scalar_one_or_none()
        if existing is not None:
            print(f"[create_admin] Admin ya existe: {existing.email}")
            return 0

        admin = User(
            email=settings.INITIAL_ADMIN_EMAIL.lower(),
            full_name="Administrador",
            password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
            role="admin_general",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print(f"[create_admin] Admin creado: {admin.email}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

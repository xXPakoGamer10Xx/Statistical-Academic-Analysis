import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=True)


DbDep = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(token: TokenDep, db: DbDep) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (jwt.PyJWTError, ValueError) as exc:
        raise credentials_exception from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Roles ────────────────────────────────────────────────────────────────────
# viewer        → solo consulta; no sube ni exporta; limitado a su escuela.
# admin_escolar → sube/gestiona datos y usuarios SOLO de su escuela.
# admin_general → todo lo anterior + ve TODAS las escuelas.

SCHOOL_ADMIN_ROLES = ("admin_escolar", "admin_general")


async def require_school_admin(current_user: CurrentUser) -> User:
    """Permite admin_escolar y admin_general (cargas, exportación, gestión de usuarios)."""
    if current_user.role not in SCHOOL_ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador (escolar o general)",
        )
    return current_user


async def require_admin_general(current_user: CurrentUser) -> User:
    """Solo admin_general (auditoría, gestión cross-escuela)."""
    if current_user.role != "admin_general":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador general",
        )
    return current_user


SchoolAdminUser = Annotated[User, Depends(require_school_admin)]
GeneralAdminUser = Annotated[User, Depends(require_admin_general)]

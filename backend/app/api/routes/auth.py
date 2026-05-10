import jwt
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbDep
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbDep) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta deshabilitada",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.subsistema_id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: DbDep) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
        if token_payload.get("type") != "refresh":
            raise HTTPException(401, "Token inválido")
        import uuid as _uuid

        user_id = _uuid.UUID(token_payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise HTTPException(401, "Token inválido o expirado") from exc

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(401, "Usuario no encontrado o inactivo")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.subsistema_id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
    )

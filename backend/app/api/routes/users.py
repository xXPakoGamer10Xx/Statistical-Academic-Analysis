import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, CurrentUser, DbDep
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser) -> User:
    return current


@router.get("", response_model=list[UserOut])
async def list_users(_admin: AdminUser, db: DbDep) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, _admin: AdminUser, db: DbDep) -> User:
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        subsistema_id=payload.subsistema_id,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "El email ya está registrado") from exc
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: uuid.UUID, _admin: AdminUser, db: DbDep) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuario no encontrado")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID, payload: UserUpdate, _admin: AdminUser, db: DbDep
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuario no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()
    for key, value in data.items():
        setattr(user, key, value)

    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "El email ya está registrado") from exc
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(user_id: uuid.UUID, admin: AdminUser, db: DbDep) -> None:
    if user_id == admin.id:
        raise HTTPException(400, "No puedes deshabilitarte a ti mismo")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuario no encontrado")
    if user.role == "admin":
        raise HTTPException(400, "No se puede deshabilitar a un administrador")
    user.is_active = False
    await db.flush()

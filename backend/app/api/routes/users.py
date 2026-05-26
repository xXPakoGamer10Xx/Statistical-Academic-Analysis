import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbDep, DirectivoUser, StaffUser
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.audit import log_action

router = APIRouter()

# ── Roles que cada caller puede gestionar ────────────────────────────────────
_MANAGEABLE_BY: dict[str, set[str]] = {
    "directivo": {"admin", "usuario"},
    "admin": {"usuario"},
}


def _assert_can_manage(caller: User, target_role: str) -> None:
    allowed = _MANAGEABLE_BY.get(caller.role, set())
    if target_role not in allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"El rol '{caller.role}' no puede gestionar cuentas con rol '{target_role}'",
        )


def _assert_subsistema_scope(caller: User, target_subsistema_id: int | None) -> None:
    """Admin solo puede gestionar usuarios de su propio subsistema."""
    if caller.role == "admin" and target_subsistema_id != caller.subsistema_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Solo puedes gestionar usuarios de tu propio subsistema",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser) -> User:
    return current


@router.get("", response_model=list[UserOut])
async def list_users(caller: StaffUser, db: DbDep) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if caller.role == "admin":
        stmt = stmt.where(User.subsistema_id == caller.subsistema_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, caller: StaffUser, db: DbDep) -> User:
    _assert_can_manage(caller, payload.role)
    if caller.role == "admin":
        _assert_subsistema_scope(caller, payload.subsistema_id)

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
    await log_action(
        db,
        caller.id,
        "user_created",
        target_type="user",
        target_id=str(user.id),
        details={"email": user.email, "role": user.role, "subsistema_id": user.subsistema_id},
    )
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: uuid.UUID, _caller: StaffUser, db: DbDep) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuario no encontrado")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID, payload: UserUpdate, caller: StaffUser, db: DbDep
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuario no encontrado")

    _assert_can_manage(caller, user.role)
    if caller.role == "admin":
        _assert_subsistema_scope(caller, user.subsistema_id)

    data = payload.model_dump(exclude_unset=True)

    if "role" in data and data["role"] is not None:
        _assert_can_manage(caller, data["role"])

    old_role = user.role
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    else:
        data.pop("password", None)
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()
    for key, value in data.items():
        setattr(user, key, value)

    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "El email ya está registrado") from exc
    await db.refresh(user)

    details: dict = {"fields": list(data.keys())}
    if "role" in data and data["role"] != old_role:
        details["old_role"] = old_role
        details["new_role"] = data["role"]
    await log_action(
        db,
        caller.id,
        "user_updated",
        target_type="user",
        target_id=str(user.id),
        details=details,
    )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(user_id: uuid.UUID, caller: StaffUser, db: DbDep) -> None:
    if user_id == caller.id:
        raise HTTPException(400, "No puedes deshabilitarte a ti mismo")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuario no encontrado")

    _assert_can_manage(caller, user.role)
    if caller.role == "admin":
        _assert_subsistema_scope(caller, user.subsistema_id)

    user.is_active = False
    await db.flush()
    await log_action(
        db,
        caller.id,
        "user_disabled",
        target_type="user",
        target_id=str(user.id),
        details={"email": user.email, "role": user.role},
    )

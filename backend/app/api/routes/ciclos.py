from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbDep, GeneralAdminUser
from app.models.ciclo_generacional import CicloGeneracional
from app.schemas.ciclo import CicloCreate, CicloOut, CicloUpdate, TipoCiclo
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=list[CicloOut])
async def list_ciclos(
    _user: CurrentUser, db: DbDep, tipo: TipoCiclo | None = Query(default=None)
) -> list[CicloGeneracional]:
    stmt = select(CicloGeneracional)
    if tipo is not None:
        stmt = stmt.where(CicloGeneracional.tipo == tipo)
    stmt = stmt.order_by(CicloGeneracional.tipo, CicloGeneracional.valor)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=CicloOut, status_code=status.HTTP_201_CREATED)
async def create_ciclo(payload: CicloCreate, caller: GeneralAdminUser, db: DbDep) -> CicloGeneracional:
    ciclo = CicloGeneracional(valor=payload.valor, tipo=payload.tipo)
    db.add(ciclo)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "Ese valor ya existe en el catálogo para este tipo") from exc
    await db.refresh(ciclo)
    await log_action(
        db,
        caller.id,
        "ciclo_generacional_created",
        target_type="ciclo_generacional",
        target_id=str(ciclo.id),
        details={"valor": ciclo.valor, "tipo": ciclo.tipo},
    )
    return ciclo


@router.patch("/{ciclo_id}", response_model=CicloOut)
async def update_ciclo(
    ciclo_id: int, payload: CicloUpdate, caller: GeneralAdminUser, db: DbDep
) -> CicloGeneracional:
    result = await db.execute(select(CicloGeneracional).where(CicloGeneracional.id == ciclo_id))
    ciclo = result.scalar_one_or_none()
    if ciclo is None:
        raise HTTPException(404, "Ciclo no encontrado")

    ciclo.activo = payload.activo
    await db.flush()
    await db.refresh(ciclo)
    await log_action(
        db,
        caller.id,
        "ciclo_generacional_updated",
        target_type="ciclo_generacional",
        target_id=str(ciclo.id),
        details={"activo": ciclo.activo},
    )
    return ciclo

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbDep, SchoolAdminUser
from app.models.programa_educativo import ProgramaEducativo
from app.schemas.programa_educativo import CarreraCreate, CarreraOut, CarreraUpdate
from app.services.audit import log_action

router = APIRouter()


def _check_subsistema_access(caller, subsistema_id: int) -> None:
    if caller.role == "admin_escolar" and subsistema_id != caller.subsistema_id:
        raise HTTPException(403, "Solo puedes administrar carreras de tu propia escuela")


@router.get("", response_model=list[CarreraOut])
async def list_carreras(
    _user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(default=None),
) -> list[ProgramaEducativo]:
    stmt = select(ProgramaEducativo)
    if subsistema_id is not None:
        stmt = stmt.where(ProgramaEducativo.subsistema_id == subsistema_id)
    stmt = stmt.order_by(ProgramaEducativo.nombre)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=CarreraOut, status_code=status.HTTP_201_CREATED)
async def create_carrera(payload: CarreraCreate, caller: SchoolAdminUser, db: DbDep) -> ProgramaEducativo:
    _check_subsistema_access(caller, payload.subsistema_id)

    par: ProgramaEducativo | None = None
    if payload.carrera_par_id is not None:
        par = (
            await db.execute(select(ProgramaEducativo).where(ProgramaEducativo.id == payload.carrera_par_id))
        ).scalar_one_or_none()
        if par is None:
            raise HTTPException(404, "La carrera par indicada no existe")
        if par.subsistema_id != payload.subsistema_id:
            raise HTTPException(400, "La carrera par debe ser de la misma escuela")

    carrera = ProgramaEducativo(
        subsistema_id=payload.subsistema_id,
        nombre=payload.nombre,
        nivel=payload.nivel,
        carrera_par_id=payload.carrera_par_id,
    )
    db.add(carrera)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "Esa carrera ya existe en el catálogo de esta escuela") from exc

    # El emparejamiento se guarda en ambos lados.
    if par is not None:
        par.carrera_par_id = carrera.id
        await db.flush()

    await db.refresh(carrera)
    await log_action(
        db,
        caller.id,
        "carrera_created",
        target_type="programa_educativo",
        target_id=str(carrera.id),
        details={"nombre": carrera.nombre, "nivel": carrera.nivel, "subsistema_id": carrera.subsistema_id},
    )
    return carrera


@router.patch("/{carrera_id}", response_model=CarreraOut)
async def update_carrera(
    carrera_id: int, payload: CarreraUpdate, caller: SchoolAdminUser, db: DbDep
) -> ProgramaEducativo:
    result = await db.execute(select(ProgramaEducativo).where(ProgramaEducativo.id == carrera_id))
    carrera = result.scalar_one_or_none()
    if carrera is None:
        raise HTTPException(404, "Carrera no encontrada")
    _check_subsistema_access(caller, carrera.subsistema_id)

    if payload.activo is not None:
        carrera.activo = payload.activo
    if payload.carrera_par_id is not None:
        nuevo_par = (
            await db.execute(select(ProgramaEducativo).where(ProgramaEducativo.id == payload.carrera_par_id))
        ).scalar_one_or_none()
        if nuevo_par is None:
            raise HTTPException(404, "La carrera par indicada no existe")
        if nuevo_par.subsistema_id != carrera.subsistema_id:
            raise HTTPException(400, "La carrera par debe ser de la misma escuela")
        carrera.carrera_par_id = nuevo_par.id
        nuevo_par.carrera_par_id = carrera.id

    await db.flush()
    await db.refresh(carrera)
    await log_action(
        db,
        caller.id,
        "carrera_updated",
        target_type="programa_educativo",
        target_id=str(carrera.id),
        details={"activo": carrera.activo, "carrera_par_id": carrera.carrera_par_id},
    )
    return carrera

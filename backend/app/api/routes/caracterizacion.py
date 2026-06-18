from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.indicadores import CaracterizacionResumen
from app.services.indicadores import calcular_caracterizacion

router = APIRouter()


@router.get("", response_model=CaracterizacionResumen)
async def get_caracterizacion(
    user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(None),
    ciclo_escolar: str | None = Query(None),
    programa_educativo: str | None = Query(None),
) -> CaracterizacionResumen:
    sid = subsistema_id if user.role == "admin_general" else user.subsistema_id
    return await calcular_caracterizacion(
        db,
        subsistema_id=sid,
        ciclo_escolar=ciclo_escolar,
        programa_educativo=programa_educativo,
    )

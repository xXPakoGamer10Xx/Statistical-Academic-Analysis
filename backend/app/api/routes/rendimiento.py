from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.indicadores import IndicadoresOpcionales, RendimientoResumen
from app.services.indicadores import calcular_indicadores_opcionales, calcular_rendimiento

router = APIRouter()


@router.get("", response_model=RendimientoResumen)
async def get_rendimiento(
    user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(None),
    ciclo_escolar: str | None = Query(None),
    programa_educativo: str | None = Query(None),
) -> RendimientoResumen:
    sid = subsistema_id if user.role == "admin" else user.subsistema_id
    return await calcular_rendimiento(
        db,
        subsistema_id=sid,
        ciclo_escolar=ciclo_escolar,
        programa_educativo=programa_educativo,
    )


@router.get("/opcionales", response_model=IndicadoresOpcionales)
async def get_opcionales(
    user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(None),
    ciclo_escolar: str | None = Query(None),
) -> IndicadoresOpcionales:
    sid = subsistema_id if user.role == "admin" else user.subsistema_id
    return await calcular_indicadores_opcionales(
        db, subsistema_id=sid, ciclo_escolar=ciclo_escolar
    )

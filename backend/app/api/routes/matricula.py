from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.indicadores import MatriculaResumen
from app.services.indicadores import calcular_matricula

router = APIRouter()


@router.get("", response_model=MatriculaResumen)
async def get_matricula(
    user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(None),
    ciclo_escolar: str | None = Query(None),
    cuatrimestre: int | None = Query(None, ge=0, le=10),
    programa_educativo: str | None = Query(None),
) -> MatriculaResumen:
    sid = subsistema_id if user.role == "admin_general" else user.subsistema_id
    return await calcular_matricula(
        db,
        subsistema_id=sid,
        ciclo_escolar=ciclo_escolar,
        cuatrimestre=cuatrimestre,
        programa_educativo=programa_educativo,
    )

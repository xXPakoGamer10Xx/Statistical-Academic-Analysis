from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.indicadores import EvaluacionDocenteResumen
from app.services.indicadores import calcular_evaluacion_docente

router = APIRouter()


@router.get("", response_model=EvaluacionDocenteResumen)
async def get_evaluacion_docente(
    user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(None),
    ciclo_escolar: str | None = Query(None),
    programa_educativo: str | None = Query(None),
) -> EvaluacionDocenteResumen:
    sid = subsistema_id if user.role in ("admin", "directivo") else user.subsistema_id
    return await calcular_evaluacion_docente(
        db,
        subsistema_id=sid,
        ciclo_escolar=ciclo_escolar,
        programa_educativo=programa_educativo,
    )

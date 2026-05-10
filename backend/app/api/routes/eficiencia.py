from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.indicadores import EficienciaResumen
from app.services.indicadores import calcular_eficiencia

router = APIRouter()


@router.get("", response_model=EficienciaResumen)
async def get_eficiencia(
    user: CurrentUser,
    db: DbDep,
    subsistema_id: int | None = Query(None),
    generaciones: list[str] | None = Query(None, description="Hasta 3 generaciones"),
    programa_educativo: str | None = Query(None),
) -> EficienciaResumen:
    if generaciones and len(generaciones) > 3:
        raise HTTPException(400, "Máximo 3 generaciones por consulta (RF-06)")
    sid = subsistema_id if user.role == "admin" else user.subsistema_id
    return await calcular_eficiencia(
        db,
        subsistema_id=sid,
        generaciones=generaciones,
        programa_educativo=programa_educativo,
    )

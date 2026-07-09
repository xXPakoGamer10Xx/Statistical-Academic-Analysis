"""Sugerencias de captura: valores ya existentes en BD para autocompletar formularios.

Catalogo NO estricto (a diferencia de allowed_values): el usuario puede elegir uno de
estos valores o escribir uno nuevo. Util para campos de texto libre sin catalogo fijo,
como programa_educativo o docente_nombre.
"""
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import ColumnElement, select, union
from sqlalchemy.sql.elements import ClauseElement

from app.api.deps import CurrentUser, DbDep
from app.models.beca import Beca
from app.models.caracterizacion import Caracterizacion
from app.models.evaluacion import EvaluacionAcademica, EvaluacionDocente
from app.models.matricula import Matricula
from app.models.titulacion import Titulacion

router = APIRouter()

SuggestionField = Literal["programa_educativo", "docente_nombre"]

MAX_SUGGESTIONS = 200

# Columnas de origen por campo sugerido (todas las tablas que capturan programa_educativo,
# o unicamente evaluacion_docente para docente_nombre).
_SOURCES: dict[str, list[ColumnElement]] = {
    "programa_educativo": [
        Matricula.programa_educativo,
        EvaluacionAcademica.programa_educativo,
        Titulacion.programa_educativo,
        EvaluacionDocente.programa_educativo,
        Beca.programa_educativo,
        Caracterizacion.programa_educativo,
    ],
    "docente_nombre": [EvaluacionDocente.docente_nombre],
}


@router.get("", response_model=list[str])
async def list_suggestions(
    _user: CurrentUser,
    db: DbDep,
    field: SuggestionField = Query(...),
    subsistema_id: int | None = Query(None),
) -> list[str]:
    columns = _SOURCES.get(field)
    if columns is None:
        raise HTTPException(400, f"field debe ser uno de: {', '.join(_SOURCES)}")

    selects: list[ClauseElement] = []
    for col in columns:
        stmt = select(col)
        if subsistema_id is not None:
            stmt = stmt.where(col.table.c.subsistema_id == subsistema_id)
        selects.append(stmt)

    result = await db.execute(union(*selects))
    values = sorted({v for (v,) in result.all() if v})
    return values[:MAX_SUGGESTIONS]

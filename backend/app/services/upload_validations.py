"""Validaciones de carga que requieren acceso a la base de datos.

Se ejecutan DESPUES de la validacion pura de ``csv_processor.py`` (sin DB) y ANTES del
upsert, tanto en la carga de archivos (``tasks.py``, sesion sincrona) como en la captura
manual (``uploads.py``, sesion async). Ambos flujos comparten esta logica pasandole los
valores ya obtenidos de la BD (statement Core ejecutable con sesion sync o async).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import Select, func, select

from app.models.ciclo_generacional import CicloGeneracional
from app.models.matricula import Matricula

# Dataset -> campo que representa su "ciclo" para efectos del catalogo.
CICLO_FIELD_BY_DATASET: dict[str, str] = {
    "matricula": "ciclo_escolar",
    "evaluacion_academica": "ciclo_escolar",
    "evaluacion_docente": "ciclo_escolar",
    "becas": "ciclo_escolar",
    "discapacidad": "ciclo_escolar",
    "etnia": "ciclo_escolar",
    "titulacion": "generacion",
}

# Dataset -> tipo de catalogo aplicable ("ciclo": ano unico, "generacion": cohorte plurianual).
CICLO_TIPO_BY_DATASET: dict[str, str] = {
    "matricula": "ciclo",
    "evaluacion_academica": "ciclo",
    "evaluacion_docente": "ciclo",
    "becas": "ciclo",
    "discapacidad": "ciclo",
    "etnia": "ciclo",
    "titulacion": "generacion",
}


def build_valid_ciclos_stmt(dataset_type: str) -> Select | None:
    """Statement Core con los valores ACTIVOS del catalogo aplicables a este dataset."""
    tipo = CICLO_TIPO_BY_DATASET.get(dataset_type)
    if tipo is None:
        return None
    return select(CicloGeneracional.valor).where(
        CicloGeneracional.tipo == tipo, CicloGeneracional.activo.is_(True)
    )


def check_ciclo_catalog(
    rows: list[dict[str, Any]], dataset_type: str, valid_values: set[str]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Filtra filas cuyo ciclo/generacion no exista (activo) en el catalogo.

    Devuelve (filas_validas, errores) con el mismo formato de error que csv_processor.
    """
    field = CICLO_FIELD_BY_DATASET.get(dataset_type)
    if field is None:
        return rows, []

    rows_ok: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        value = row.get(field)
        if value not in valid_values:
            errors.append(
                {
                    "row": idx + 1,
                    "column": field,
                    "value": value,
                    "error": "no existe en el catálogo de ciclos generacionales o está deshabilitado",
                }
            )
            continue
        rows_ok.append(row)
    return rows_ok, errors


MADRES_SOLTERAS_TIPO = "madres solteras"


def build_mujeres_matriculadas_stmt(
    subsistema_id: int, ciclo_escolar: str, programa_educativo: str
) -> Select:
    """Maximo de mujeres matriculadas para esa combinacion (entre cuatrimestres del ciclo).

    Se usa MAX y no SUM: sumar cuatrimestres duplicaria alumnas que siguen inscritas varios
    cuatrimestres dentro del mismo ciclo escolar. Es una aproximacion agregada de consistencia,
    no una verificacion real por alumno (el sistema no registra alumnos individuales).
    """
    return select(func.max(Matricula.mujeres)).where(
        Matricula.subsistema_id == subsistema_id,
        Matricula.ciclo_escolar == ciclo_escolar,
        Matricula.programa_educativo == programa_educativo,
    )


def check_madres_solteras(
    rows: list[dict[str, Any]], mujeres_by_key: dict[tuple[Any, Any, Any], int]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Valida filas de tipo 'Madres solteras': deben ser sexo=Mujer y no exceder las
    mujeres matriculadas conocidas para esa combinacion (subsistema, ciclo, programa).

    Si aun no hay matricula cargada para esa combinacion, el chequeo de cantidad no se
    bloquea: es una limitacion conocida por la falta de relacion entre las tablas ``becas``
    y ``matricula``. El chequeo de sexo si es siempre estricto (dato propio de la fila).
    """
    rows_ok: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        tipo = str(row.get("tipo") or "").strip().lower()
        if tipo != MADRES_SOLTERAS_TIPO:
            rows_ok.append(row)
            continue

        sexo = str(row.get("sexo") or "").strip().lower()
        if sexo and sexo != "mujer":
            errors.append(
                {
                    "row": idx + 1,
                    "column": "sexo",
                    "value": row.get("sexo"),
                    "error": "'Madres solteras' solo aplica a sexo Mujer.",
                }
            )
            continue

        key = (row.get("subsistema_id"), row.get("ciclo_escolar"), row.get("programa_educativo"))
        mujeres = mujeres_by_key.get(key)
        cantidad = row.get("cantidad")
        if mujeres is not None and isinstance(cantidad, int) and cantidad > mujeres:
            errors.append(
                {
                    "row": idx + 1,
                    "column": "cantidad",
                    "value": cantidad,
                    "error": (
                        f"'Madres solteras': cantidad ({cantidad}) excede el número de "
                        f"mujeres matriculadas ({mujeres}) para este programa/ciclo."
                    ),
                }
            )
            continue
        rows_ok.append(row)
    return rows_ok, errors


def mujeres_keys_from_rows(rows: list[dict[str, Any]]) -> set[tuple[Any, Any, Any]]:
    """Combinaciones (subsistema_id, ciclo_escolar, programa_educativo) presentes en las filas."""
    return {
        (r.get("subsistema_id"), r.get("ciclo_escolar"), r.get("programa_educativo"))
        for r in rows
        if r.get("subsistema_id") and r.get("ciclo_escolar") and r.get("programa_educativo")
    }

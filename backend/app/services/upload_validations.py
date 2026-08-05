"""Validaciones de carga que requieren acceso a la base de datos.

Se ejecutan DESPUES de la validacion pura de ``csv_processor.py`` (sin DB) y ANTES del
upsert, tanto en la carga de archivos (``tasks.py``, sesion sincrona) como en la captura
manual (``uploads.py``, sesion async). Ambos flujos comparten esta logica pasandole los
valores ya obtenidos de la BD (statement Core ejecutable con sesion sync o async).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import Select, and_, func, or_, select

from app.models.ciclo_generacional import CicloGeneracional
from app.models.matricula import Matricula
from app.services.formulas import calculate_matricula_actual

# Dataset -> campo que representa su "ciclo" para efectos del catalogo.
CICLO_FIELD_BY_DATASET: dict[str, str] = {
    "matricula": "ciclo_escolar",
    "nuevo_ingreso": "ciclo_escolar",
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
    "nuevo_ingreso": "ciclo",
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


# ---------------------------------------------------------------------------
# Matricula: nuevo_ingreso calculado + arrastre de "total" desde el cuatrimestre anterior.
#
# El formulario ya no captura "total" (base de la Matricula Actual) ni "nuevo_ingreso" (un solo
# numero): en vez de eso se capturan Examen/Pase Directo/RENOES, y "total" se materializa aqui
# como la Matricula Actual ya calculada del periodo inmediatamente anterior de esa misma
# carrera (0 si es la primera vez que se captura). Se materializa en vez de derivarse en cada
# consulta porque "total" tambien se usa directamente (sumado) en calcular_rendimiento() y
# calcular_indicadores_opcionales() (reprobacion/desercion/cobertura), no solo en
# calculate_matricula_actual().
# ---------------------------------------------------------------------------


def _group_matricula_rows_for_carry_forward(
    rows: list[dict[str, Any]]
) -> dict[tuple[Any, Any], list[dict[str, Any]]]:
    """Agrupa filas de matricula por (subsistema_id, programa_educativo) y las ordena
    cronologicamente (ciclo_escolar, cuatrimestre) dentro de cada grupo."""
    groups: dict[tuple[Any, Any], list[dict[str, Any]]] = {}
    for row in rows:
        key = (row.get("subsistema_id"), row.get("programa_educativo"))
        groups.setdefault(key, []).append(row)
    for group_rows in groups.values():
        group_rows.sort(key=lambda r: (str(r.get("ciclo_escolar")), int(r.get("cuatrimestre") or 0)))
    return groups


def matricula_carry_forward_lookups(
    rows: list[dict[str, Any]]
) -> dict[tuple[Any, Any], tuple[str, int]]:
    """Para cada grupo (subsistema_id, programa_educativo) del lote, el periodo mas antiguo
    presente — es el punto de referencia para buscar en BD la Matricula Actual inmediatamente
    anterior (una sola consulta por grupo, no por fila)."""
    groups = _group_matricula_rows_for_carry_forward(rows)
    return {
        key: (str(group_rows[0].get("ciclo_escolar")), int(group_rows[0].get("cuatrimestre") or 0))
        for key, group_rows in groups.items()
    }


def build_previous_matricula_stmt(
    subsistema_id: Any, programa_educativo: Any, ciclo_escolar: str, cuatrimestre: int
) -> Select:
    """Statement con total/bajas/nuevo_ingreso de la fila de Matricula mas reciente,
    estrictamente anterior a (ciclo_escolar, cuatrimestre), para esa carrera."""
    return (
        select(
            Matricula.total,
            Matricula.bajas_reprobacion,
            Matricula.bajas_desercion,
            Matricula.nuevo_ingreso,
        )
        .where(
            Matricula.subsistema_id == subsistema_id,
            Matricula.programa_educativo == programa_educativo,
            or_(
                Matricula.ciclo_escolar < ciclo_escolar,
                and_(Matricula.ciclo_escolar == ciclo_escolar, Matricula.cuatrimestre < cuatrimestre),
            ),
        )
        .order_by(Matricula.ciclo_escolar.desc(), Matricula.cuatrimestre.desc())
        .limit(1)
    )


def apply_matricula_carry_forward(
    rows: list[dict[str, Any]],
    previous_by_key: dict[tuple[Any, Any], dict[str, int] | None],
) -> None:
    """Calcula, en orden cronologico dentro de cada grupo (subsistema_id, programa_educativo):
    - "nuevo_ingreso" = ingreso_examen + ingreso_pase_directo + ingreso_renoes — solo se agrega
      (y por lo tanto solo se persiste) cuando la fila trae al menos uno de esos 3 campos, es
      decir, cuando viene del dataset "nuevo_ingreso". Una captura de "matricula" (que ya no
      trae esos campos) no debe pisar a 0 el nuevo_ingreso ya capturado para ese periodo.
    - "total" = Matricula Actual del periodo anterior (0 si no existe periodo anterior) —
      se calcula siempre, para ambos datasets ("matricula" y "nuevo_ingreso" comparten la
      misma fila por periodo/carrera), de forma determinista/idempotente.

    Modifica `rows` in-place agregando esas claves. `previous_by_key` trae, por grupo, los
    campos de la fila de BD inmediatamente anterior (o None si es la primera captura de esa
    carrera) obtenidos via build_previous_matricula_stmt.
    """
    ingreso_fields = ("ingreso_examen", "ingreso_pase_directo", "ingreso_renoes")
    groups = _group_matricula_rows_for_carry_forward(rows)
    for key, group_rows in groups.items():
        previous = previous_by_key.get(key)
        last_known_total = (
            calculate_matricula_actual(
                previous["total"],
                previous["bajas_reprobacion"],
                previous["bajas_desercion"],
                previous["nuevo_ingreso"],
            )
            if previous
            else 0
        )
        for row in group_rows:
            has_ingreso_fields = any(f in row for f in ingreso_fields)
            nuevo_ingreso = (
                int(row.get("ingreso_examen") or 0)
                + int(row.get("ingreso_pase_directo") or 0)
                + int(row.get("ingreso_renoes") or 0)
                if has_ingreso_fields
                else 0
            )
            if has_ingreso_fields:
                row["nuevo_ingreso"] = nuevo_ingreso
            row["total"] = last_known_total
            last_known_total = calculate_matricula_actual(
                last_known_total,
                int(row.get("bajas_reprobacion") or 0),
                int(row.get("bajas_desercion") or 0),
                nuevo_ingreso,
            )

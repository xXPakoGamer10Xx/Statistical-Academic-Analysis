"""Tareas Celery — procesamiento async de cargas CSV."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.beca import Beca
from app.models.caracterizacion import Caracterizacion
from app.models.evaluacion import EvaluacionAcademica, EvaluacionDocente
from app.models.matricula import Matricula
from app.models.titulacion import Titulacion
from app.models.upload_job import UploadJob
from app.services.csv_processor import (
    parse_and_validate_smart,
    rows_from_dataframe,
    sanitize_errors_for_json,
)
from app.services.upload_validations import (
    apply_matricula_carry_forward,
    build_mujeres_matriculadas_stmt,
    build_previous_matricula_stmt,
    build_valid_ciclos_stmt,
    check_ciclo_catalog,
    check_madres_solteras,
    matricula_carry_forward_lookups,
    matricula_conflict_set,
    mujeres_keys_from_rows,
)
from app.workers.celery_app import celery_app

# Engine sincrónico para Celery (Celery no juega bien con asyncio por defecto)
_sync_engine = create_engine(settings.database_url_str, pool_pre_ping=True, future=True)


MODEL_BY_TYPE = {
    "matricula": Matricula,
    "nuevo_ingreso": Matricula,
    "evaluacion_academica": EvaluacionAcademica,
    "titulacion": Titulacion,
    "evaluacion_docente": EvaluacionDocente,
    "becas": Beca,
    "discapacidad": Caracterizacion,
    "etnia": Caracterizacion,
}

# "discapacidad"/"etnia" son datasets de carga independientes en la UI, pero comparten la
# tabla `caracterizacion` (columna `categoria`); el dataset type determina su valor.
CATEGORIA_BY_DATASET: dict[str, str] = {
    "discapacidad": "discapacidad",
    "etnia": "etnia",
}

DEDUP_KEYS: dict[str, tuple[str, ...]] = {
    "matricula": ("subsistema_id", "ciclo_escolar", "cuatrimestre", "programa_educativo"),
    "nuevo_ingreso": ("subsistema_id", "ciclo_escolar", "cuatrimestre", "programa_educativo"),
    "titulacion": ("subsistema_id", "generacion", "programa_educativo"),
    "becas": ("subsistema_id", "ciclo_escolar", "programa_educativo", "tipo", "sexo"),
    "discapacidad": ("subsistema_id", "ciclo_escolar", "programa_educativo", "categoria", "tipo", "sexo"),
    "etnia": ("subsistema_id", "ciclo_escolar", "programa_educativo", "categoria", "tipo", "sexo"),
}


def _dedup_rows(dataset_type: str, rows: list[dict]) -> list[dict]:
    keys = DEDUP_KEYS.get(dataset_type)
    if not keys:
        return rows
    seen: dict[tuple, dict] = {}
    for row in rows:
        k = tuple(row.get(key) for key in keys)
        seen[k] = row
    return list(seen.values())


def _upsert_rows(session: Session, dataset_type: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    model = MODEL_BY_TYPE[dataset_type]
    stmt = pg_insert(model.__table__).values(rows)

    if dataset_type in ("matricula", "nuevo_ingreso"):
        stmt = stmt.on_conflict_do_update(
            constraint="uq_matricula_periodo",
            set_=matricula_conflict_set(stmt, rows),
        )
    elif dataset_type == "titulacion":
        stmt = stmt.on_conflict_do_update(
            constraint="uq_titulacion_generacion",
            set_={c: stmt.excluded[c] for c in [
                "matricula_generacional", "concluyeron_estudios", "egresados", "titulados",
                "ingresados_ns",
            ] if c in rows[0]},
        )
    elif dataset_type == "becas":
        stmt = stmt.on_conflict_do_update(
            constraint="uq_beca",
            set_={"cantidad": stmt.excluded["cantidad"]},
        )
    elif dataset_type in ("discapacidad", "etnia"):
        stmt = stmt.on_conflict_do_update(
            constraint="uq_caracterizacion",
            set_={"cantidad": stmt.excluded["cantidad"]},
        )

    result = session.execute(stmt)
    return result.rowcount or len(rows)


def _count_failed_rows(errors: list[dict]) -> int:
    return len({error["row"] for error in errors})


def _apply_db_validations(session: Session, dataset_type: str, rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Validaciones que requieren BD (catalogo de ciclos, consistencia de becas). Ver upload_validations.py."""
    all_errors: list[dict] = []

    valid_ciclos_stmt = build_valid_ciclos_stmt(dataset_type)
    if valid_ciclos_stmt is not None:
        valid_ciclos = {v for (v,) in session.execute(valid_ciclos_stmt).all()}
        rows, ciclo_errors = check_ciclo_catalog(rows, dataset_type, valid_ciclos)
        all_errors.extend(ciclo_errors)

    if dataset_type == "becas":
        mujeres_by_key: dict[tuple, int] = {}
        for subsistema_id, ciclo_escolar, programa_educativo in mujeres_keys_from_rows(rows):
            stmt = build_mujeres_matriculadas_stmt(subsistema_id, ciclo_escolar, programa_educativo)
            mujeres = session.execute(stmt).scalar()
            if mujeres is not None:
                mujeres_by_key[(subsistema_id, ciclo_escolar, programa_educativo)] = mujeres
        rows, madres_errors = check_madres_solteras(rows, mujeres_by_key)
        all_errors.extend(madres_errors)

    if dataset_type in ("matricula", "nuevo_ingreso") and rows:
        lookups = matricula_carry_forward_lookups(rows)
        previous_by_key: dict[tuple, dict[str, int] | None] = {}
        for (subsistema_id, programa_educativo), (ciclo_escolar, cuatrimestre) in lookups.items():
            stmt = build_previous_matricula_stmt(subsistema_id, programa_educativo, ciclo_escolar, cuatrimestre)
            previous_row = session.execute(stmt).first()
            previous_by_key[(subsistema_id, programa_educativo)] = (
                {
                    "total": previous_row.total,
                    "bajas_reprobacion": previous_row.bajas_reprobacion,
                    "bajas_desercion": previous_row.bajas_desercion,
                    "nuevo_ingreso": previous_row.nuevo_ingreso,
                    "otros_ingresos": previous_row.otros_ingresos,
                }
                if previous_row is not None
                else None
            )
        apply_matricula_carry_forward(rows, previous_by_key)

    return rows, all_errors


@celery_app.task(bind=True, name="process_csv_upload", max_retries=2)
def process_csv_upload(self, job_id: str) -> dict:  # noqa: ARG001 (self requerido por bind=True)
    job_uuid = uuid.UUID(job_id)
    with Session(_sync_engine) as session:
        job = session.get(UploadJob, job_uuid)
        if job is None:
            return {"status": "not_found", "job_id": job_id}

        try:
            job.status = "processing"
            session.commit()

            cfg = job.mapping_config or {}
            df, errors = parse_and_validate_smart(
                job.file_path,
                job.dataset_type,
                sheet_name=cfg.get("sheet_name"),
                header_row=cfg.get("header_row", 0),
                column_mapping=cfg.get("column_mapping"),
            )
            df["subsistema_id"] = job.subsistema_id
            if job.dataset_type in CATEGORIA_BY_DATASET:
                df["categoria"] = CATEGORIA_BY_DATASET[job.dataset_type]

            dedup_keys = list(DEDUP_KEYS.get(job.dataset_type, []))
            if dedup_keys:
                df = df.drop_duplicates(subset=dedup_keys, keep="last")

            rows = rows_from_dataframe(df)
            rows, db_errors = _apply_db_validations(session, job.dataset_type, rows)
            errors.extend(db_errors)
            rows_total = int(len(rows) + _count_failed_rows(errors))

            inserted = _upsert_rows(session, job.dataset_type, rows)

            job.rows_total = rows_total
            job.rows_processed = int(inserted)
            job.rows_failed = _count_failed_rows(errors)
            job.errors = sanitize_errors_for_json(errors[:500] if errors else None)
            job.status = "success" if not errors else "success_with_warnings"
            job.completed_at = datetime.now(UTC)
            session.commit()

            return {"status": job.status, "processed": inserted, "errors": len(errors)}
        except Exception as exc:
            session.rollback()
            job = session.get(UploadJob, job_uuid)
            if job is not None:
                job.status = "failed"
                job.error_message = str(exc)[:1000]
                job.completed_at = datetime.now(UTC)
                session.commit()
            Path(job.file_path).unlink(missing_ok=True)
            raise

"""Tareas Celery — procesamiento async de cargas CSV."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.evaluacion import EvaluacionAcademica, EvaluacionDocente
from app.models.matricula import Matricula
from app.models.titulacion import Titulacion
from app.models.upload_job import UploadJob
from app.services.csv_processor import parse_and_validate_smart
from app.workers.celery_app import celery_app

# Engine sincrónico para Celery (Celery no juega bien con asyncio por defecto)
_sync_engine = create_engine(settings.database_url_str, pool_pre_ping=True, future=True)


MODEL_BY_TYPE = {
    "matricula": Matricula,
    "evaluacion_academica": EvaluacionAcademica,
    "titulacion": Titulacion,
    "evaluacion_docente": EvaluacionDocente,
}

DEDUP_KEYS: dict[str, tuple[str, ...]] = {
    "matricula": ("subsistema_id", "ciclo_escolar", "cuatrimestre", "programa_educativo"),
    "titulacion": ("subsistema_id", "generacion", "programa_educativo"),
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

    if dataset_type == "matricula":
        stmt = stmt.on_conflict_do_update(
            constraint="uq_matricula_periodo",
            set_={c: stmt.excluded[c] for c in [
                "total", "nuevo_ingreso", "bajas_reprobacion", "bajas_desercion",
                "hombres", "mujeres", "poblacion_edad_escolar", "egresados_nms",
            ] if c in rows[0]},
        )
    elif dataset_type == "titulacion":
        stmt = stmt.on_conflict_do_update(
            constraint="uq_titulacion_generacion",
            set_={c: stmt.excluded[c] for c in [
                "matricula_generacional", "concluyeron_estudios", "egresados", "titulados",
                "ingresados_ns",
            ] if c in rows[0]},
        )

    result = session.execute(stmt)
    return result.rowcount or len(rows)


def _count_failed_rows(errors: list[dict]) -> int:
    return len({error["row"] for error in errors})


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

            dedup_keys = list(DEDUP_KEYS.get(job.dataset_type, []))
            if dedup_keys:
                df = df.drop_duplicates(subset=dedup_keys, keep="last")

            rows = df.to_dict(orient="records")
            rows_total = int(len(rows) + _count_failed_rows(errors))

            inserted = _upsert_rows(session, job.dataset_type, rows)

            job.rows_total = rows_total
            job.rows_processed = int(inserted)
            job.rows_failed = _count_failed_rows(errors)
            job.errors = errors[:500] if errors else None
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

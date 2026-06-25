import hashlib
import json
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.deps import SchoolAdminUser, DbDep
from app.services.audit import log_action
from app.core.config import settings
from app.models.upload_job import UploadJob
from app.schemas.upload import (
    DatasetType,
    ExcelAnalysisOut,
    SheetAnalysisOut,
    ColumnMappingItem,
    DatasetTypeScore,
    ManualUploadIn,
    ManualUploadOut,
    UploadCompareOut,
    UploadCompareSummary,
    UploadJobOut,
    FieldChange,
    RowDiff,
)
from app.services.csv_processor import parse_and_validate_smart, validate_rows
from app.services.dataset_definitions import DATASET_DEFINITIONS
from app.services.excel_analyzer import analyze_upload_bytes, SheetAnalysis
from app.services.upload_diff import (
    compare_upload_with_baseline,
    get_compare_keys,
    load_baseline_rows,
)
from app.workers.tasks import DEDUP_KEYS, MODEL_BY_TYPE, process_csv_upload

router = APIRouter()

ALLOWED_TYPES: tuple[DatasetType, ...] = tuple(DATASET_DEFINITIONS.keys())


def _sheet_to_out(sa: SheetAnalysis) -> SheetAnalysisOut:
    return SheetAnalysisOut(
        sheet_name=sa.sheet_name,
        header_row=sa.header_row,
        detected_headers=sa.detected_headers,
        header_column_indices=sa.header_column_indices,
        sample_rows=sa.sample_rows,
        suggested_dataset_type=sa.suggested_dataset_type,
        dataset_type_scores=[
            DatasetTypeScore(dataset_type=s.dataset_type, score=s.score, label=s.label)
            for s in sa.dataset_type_scores
        ],
        column_mapping=[
            ColumnMappingItem(excel_column=m.excel_column, system_field=m.system_field, confidence=m.confidence)
            for m in sa.column_mapping
        ],
        has_merged_cells=sa.has_merged_cells,
        total_data_rows=sa.total_data_rows,
        warnings=sa.warnings,
    )


@router.post("/analyze", response_model=ExcelAnalysisOut)
async def analyze_excel(
    admin: SchoolAdminUser,  # noqa: ARG001
    file: UploadFile = File(...),
) -> ExcelAnalysisOut:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".xlsx", ".xls", ".csv"}:
        raise HTTPException(
            400,
            "Solo se aceptan archivos Excel (.xlsx, .xls) o CSV (.csv) para el análisis automático",
        )

    contents = await file.read()
    max_size = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(413, f"Archivo excede el tamaño máximo ({settings.UPLOAD_MAX_SIZE_MB}MB)")

    try:
        analysis = analyze_upload_bytes(contents, suffix=suffix or ".xlsx")
    except Exception as exc:
        raise HTTPException(422, f"No se pudo analizar el archivo: {exc}") from exc

    return ExcelAnalysisOut(
        sheet_names=analysis.sheet_names,
        sheets=[_sheet_to_out(s) for s in analysis.sheets],
        recommended_sheet=analysis.recommended_sheet,
    )


def _count_failed_rows(errors: list[dict]) -> int:
    return len({error["row"] for error in errors})


def _parse_mapping_config(
    column_mapping: str | None,
    sheet_name: str | None,
    header_row: int,
) -> dict | None:
    parsed_mapping: dict | None = None
    if column_mapping:
        try:
            parsed_mapping = json.loads(column_mapping)
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(400, "column_mapping debe ser un JSON válido") from exc

    if parsed_mapping or sheet_name or header_row != 0:
        return {
            "sheet_name": sheet_name,
            "header_row": header_row,
            "column_mapping": parsed_mapping,
        }
    return None


@router.post("/compare", response_model=UploadCompareOut)
async def compare_upload(
    admin: SchoolAdminUser,
    db: DbDep,
    subsistema_id: int = Form(...),
    dataset_type: str = Form(...),
    file: UploadFile = File(...),
    sheet_name: str | None = Form(None),
    header_row: int = Form(0),
    column_mapping: str | None = Form(None),
) -> UploadCompareOut:
    if dataset_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipo de dataset inválido. Permitidos: {ALLOWED_TYPES}")

    if admin.role == "admin_escolar" and subsistema_id != admin.subsistema_id:
        raise HTTPException(403, "Solo puedes comparar datos de tu propia escuela")

    if not file.filename or not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "El archivo debe ser CSV o Excel (.xlsx, .xls)")

    contents = await file.read()
    max_size = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(413, f"Archivo excede el tamaño máximo ({settings.UPLOAD_MAX_SIZE_MB}MB)")

    mapping_config = _parse_mapping_config(column_mapping, sheet_name, header_row)
    file_sha256 = hashlib.sha256(contents).hexdigest()

    suffix = Path(file.filename).suffix.lower() or ".csv"
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            temp_path = Path(tmp.name)

        df, errors = parse_and_validate_smart(
            str(temp_path),
            dataset_type,
            sheet_name=mapping_config.get("sheet_name") if mapping_config else None,
            header_row=mapping_config.get("header_row", 0) if mapping_config else 0,
            column_mapping=mapping_config.get("column_mapping") if mapping_config else None,
        )
        df["subsistema_id"] = subsistema_id

        dedup_keys = list(get_compare_keys(dataset_type))
        df = df.drop_duplicates(subset=dedup_keys, keep="last")

        new_rows = df.to_dict(orient="records")
        baseline_rows = await load_baseline_rows(db, dataset_type, subsistema_id)
        diff = compare_upload_with_baseline(new_rows, baseline_rows, dataset_type)

        last_upload = await db.execute(
            select(UploadJob)
            .where(
                UploadJob.subsistema_id == subsistema_id,
                UploadJob.dataset_type == dataset_type,
                UploadJob.status.in_(("success", "success_with_warnings")),
            )
            .order_by(UploadJob.created_at.desc())
            .limit(1)
        )
        previous_job = last_upload.scalar_one_or_none()
        identical_to_last_upload = bool(previous_job and previous_job.file_sha256 == file_sha256)

        return UploadCompareOut(
            dataset_type=dataset_type,
            subsistema_id=subsistema_id,
            baseline_rows=len(baseline_rows),
            new_rows_valid=len(new_rows),
            validation_errors=_count_failed_rows(errors),
            identical_to_last_upload=identical_to_last_upload,
            summary=UploadCompareSummary(**diff["summary"]),
            added=[RowDiff(**item) for item in diff["added"]],
            removed=[RowDiff(**item) for item in diff["removed"]],
            modified=[
                RowDiff(
                    key=item["key"],
                    changes=[FieldChange(**change) for change in item["changes"]],
                )
                for item in diff["modified"]
            ],
            truncated=diff["truncated"],
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@router.post("", response_model=UploadJobOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_csv(
    admin: SchoolAdminUser,
    db: DbDep,
    subsistema_id: int = Form(...),
    dataset_type: str = Form(...),
    file: UploadFile = File(...),
    sheet_name: str | None = Form(None),
    header_row: int = Form(0),
    column_mapping: str | None = Form(None),
) -> UploadJob:
    if dataset_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipo de dataset inválido. Permitidos: {ALLOWED_TYPES}")

    # admin_escolar solo puede cargar datos de su propia escuela
    if admin.role == "admin_escolar" and subsistema_id != admin.subsistema_id:
        raise HTTPException(403, "Solo puedes cargar datos de tu propia escuela")

    if not file.filename or not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "El archivo debe ser CSV o Excel (.xlsx, .xls)")

    contents = await file.read()
    max_size = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(413, f"Archivo excede el tamaño máximo ({settings.UPLOAD_MAX_SIZE_MB}MB)")

    mapping_config = _parse_mapping_config(column_mapping, sheet_name, header_row)

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    job_id = uuid.uuid4()
    safe_name = f"{job_id}_{Path(file.filename).name}"
    file_path = upload_dir / safe_name
    file_path.write_bytes(contents)
    file_sha256 = hashlib.sha256(contents).hexdigest()

    job = UploadJob(
        id=job_id,
        user_id=admin.id,
        subsistema_id=subsistema_id,
        dataset_type=dataset_type,
        filename=file.filename,
        file_path=str(file_path),
        file_size_bytes=len(contents),
        file_sha256=file_sha256,
        status="pending",
        mapping_config=mapping_config,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    process_csv_upload.delay(str(job_id))
    await log_action(
        db,
        admin.id,
        "upload",
        target_type="upload",
        target_id=str(job_id),
        details={
            "dataset_type": dataset_type,
            "subsistema_id": subsistema_id,
            "filename": file.filename,
            "size_bytes": len(contents),
            "smart_mapping": mapping_config is not None,
        },
    )
    return job


def _build_upsert_stmt(dataset_type: str, rows: list[dict]):
    """Construye el INSERT ... ON CONFLICT DO UPDATE (mismo criterio que la carga de archivos)."""
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
    elif dataset_type == "becas":
        stmt = stmt.on_conflict_do_update(
            constraint="uq_beca",
            set_={"cantidad": stmt.excluded["cantidad"]},
        )
    elif dataset_type == "caracterizacion":
        stmt = stmt.on_conflict_do_update(
            constraint="uq_caracterizacion",
            set_={"cantidad": stmt.excluded["cantidad"]},
        )
    return stmt


@router.post("/manual", response_model=ManualUploadOut, status_code=status.HTTP_201_CREATED)
async def manual_upload(payload: ManualUploadIn, admin: SchoolAdminUser, db: DbDep) -> ManualUploadOut:
    """Captura manual de datos (sin archivo): valida y hace upsert directo en la BD."""
    if payload.dataset_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipo de dataset inválido. Permitidos: {ALLOWED_TYPES}")

    # admin_escolar solo puede capturar datos de su propia escuela
    if admin.role == "admin_escolar" and payload.subsistema_id != admin.subsistema_id:
        raise HTTPException(403, "Solo puedes capturar datos de tu propia escuela")

    valid_rows, errors = validate_rows(payload.dataset_type, payload.rows)
    if not valid_rows:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Ninguna fila es válida", "errors": errors[:500]},
        )

    # Deduplicar por las mismas llaves que la carga de archivos
    dedup_keys = DEDUP_KEYS.get(payload.dataset_type)
    if dedup_keys:
        seen: dict[tuple, dict] = {}
        for row in valid_rows:
            row["subsistema_id"] = payload.subsistema_id
            seen[tuple(row.get(k) for k in dedup_keys)] = row
        rows = list(seen.values())
    else:
        for row in valid_rows:
            row["subsistema_id"] = payload.subsistema_id
        rows = valid_rows

    result = await db.execute(_build_upsert_stmt(payload.dataset_type, rows))
    processed = result.rowcount or len(rows)

    await log_action(
        db,
        admin.id,
        "manual_upload",
        target_type="dataset",
        target_id=payload.dataset_type,
        details={
            "subsistema_id": payload.subsistema_id,
            "rows_received": len(payload.rows),
            "rows_processed": processed,
            "rows_failed": len({e["row"] for e in errors}),
        },
    )

    return ManualUploadOut(
        dataset_type=payload.dataset_type,
        rows_received=len(payload.rows),
        rows_processed=int(processed),
        rows_failed=len({e["row"] for e in errors}),
        errors=errors[:500] if errors else None,
    )


@router.get("", response_model=list[UploadJobOut])
async def list_jobs(_admin: SchoolAdminUser, db: DbDep, limit: int = 50) -> list[UploadJob]:
    result = await db.execute(
        select(UploadJob).order_by(UploadJob.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{job_id}", response_model=UploadJobOut)
async def get_job(job_id: uuid.UUID, _admin: SchoolAdminUser, db: DbDep) -> UploadJob:
    result = await db.execute(select(UploadJob).where(UploadJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job no encontrado")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: uuid.UUID, _admin: SchoolAdminUser, db: DbDep) -> None:
    result = await db.execute(select(UploadJob).where(UploadJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job no encontrado")
    Path(job.file_path).unlink(missing_ok=True)
    await db.delete(job)
    await db.flush()

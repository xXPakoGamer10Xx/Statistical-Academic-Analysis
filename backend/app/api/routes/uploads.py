import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import AdminUser, DbDep
from app.core.config import settings
from app.models.upload_job import UploadJob
from app.schemas.upload import DatasetType, UploadJobOut
from app.services.dataset_definitions import DATASET_DEFINITIONS
from app.workers.tasks import process_csv_upload

router = APIRouter()

ALLOWED_TYPES: tuple[DatasetType, ...] = tuple(DATASET_DEFINITIONS.keys())


@router.post("", response_model=UploadJobOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_csv(
    admin: AdminUser,
    db: DbDep,
    subsistema_id: int = Form(...),
    dataset_type: str = Form(...),
    file: UploadFile = File(...),
) -> UploadJob:
    if dataset_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipo de dataset inválido. Permitidos: {ALLOWED_TYPES}")

    if not file.filename or not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "El archivo debe ser CSV o Excel (.xlsx, .xls)")

    contents = await file.read()
    max_size = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(413, f"Archivo excede el tamaño máximo ({settings.UPLOAD_MAX_SIZE_MB}MB)")

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
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    process_csv_upload.delay(str(job_id))
    return job


@router.get("", response_model=list[UploadJobOut])
async def list_jobs(_admin: AdminUser, db: DbDep, limit: int = 50) -> list[UploadJob]:
    result = await db.execute(
        select(UploadJob).order_by(UploadJob.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{job_id}", response_model=UploadJobOut)
async def get_job(job_id: uuid.UUID, _admin: AdminUser, db: DbDep) -> UploadJob:
    result = await db.execute(select(UploadJob).where(UploadJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job no encontrado")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: uuid.UUID, _admin: AdminUser, db: DbDep) -> None:
    result = await db.execute(select(UploadJob).where(UploadJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job no encontrado")
    Path(job.file_path).unlink(missing_ok=True)
    await db.delete(job)
    await db.flush()

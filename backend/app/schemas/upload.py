import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


DatasetType = Literal["matricula", "evaluacion_academica", "titulacion", "evaluacion_docente"]


class UploadJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subsistema_id: int
    dataset_type: str
    filename: str
    status: str
    rows_total: int
    rows_processed: int
    rows_failed: int
    file_size_bytes: int
    file_sha256: str
    errors: list[dict] | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class DatasetFieldOut(BaseModel):
    name: str
    kind: str
    required: bool
    description: str | None = None
    allowed_values: list[str] | None = None


class DatasetDefinitionOut(BaseModel):
    key: DatasetType
    label: str
    description: str
    fields: list[DatasetFieldOut]

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DatasetType = Literal[
    "matricula",
    "evaluacion_academica",
    "titulacion",
    "evaluacion_docente",
    "caracterizacion",
]


# ---------------------------------------------------------------------------
# Schemas de análisis de Excel
# ---------------------------------------------------------------------------

class ColumnMappingItem(BaseModel):
    excel_column: str
    system_field: str | None = None
    confidence: float


class DatasetTypeScore(BaseModel):
    dataset_type: str
    score: float
    label: str


class SheetAnalysisOut(BaseModel):
    sheet_name: str
    header_row: int
    detected_headers: list[str]
    header_column_indices: list[int] = []
    sample_rows: list[list[str]]
    suggested_dataset_type: str | None
    dataset_type_scores: list[DatasetTypeScore]
    column_mapping: list[ColumnMappingItem]
    has_merged_cells: bool
    total_data_rows: int
    warnings: list[str]


class ExcelAnalysisOut(BaseModel):
    sheet_names: list[str]
    sheets: list[SheetAnalysisOut]
    recommended_sheet: str | None


# ---------------------------------------------------------------------------
# Schemas de upload existentes
# ---------------------------------------------------------------------------

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
    suggested_values: list[str] | None = None


# ---------------------------------------------------------------------------
# Captura manual (sin archivo)
# ---------------------------------------------------------------------------

class ManualUploadIn(BaseModel):
    subsistema_id: int
    dataset_type: DatasetType
    rows: list[dict] = Field(..., min_length=1, max_length=1000)


class ManualUploadOut(BaseModel):
    dataset_type: str
    rows_received: int
    rows_processed: int
    rows_failed: int
    errors: list[dict] | None = None


class DatasetDefinitionOut(BaseModel):
    key: DatasetType
    label: str
    description: str
    fields: list[DatasetFieldOut]
    catalogos: dict[str, list[str]] | None = None

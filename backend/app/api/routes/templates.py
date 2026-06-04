"""Endpoint para descargar plantillas Excel de cada tipo de dataset."""
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
import openpyxl

from app.schemas.upload import DatasetDefinitionOut, DatasetFieldOut
from app.services.dataset_definitions import DATASET_DEFINITIONS, get_dataset_definition

router = APIRouter()


@router.get("/formats", response_model=list[DatasetDefinitionOut])
async def list_dataset_formats() -> list[DatasetDefinitionOut]:
    return [
        DatasetDefinitionOut(
            key=definition.key,
            label=definition.label,
            description=definition.description,
            fields=[
                DatasetFieldOut(
                    name=field.name,
                    kind=field.kind,
                    required=field.required,
                    description=field.description,
                    allowed_values=list(field.allowed_values) if field.allowed_values else None,
                )
                for field in definition.fields
            ],
        )
        for definition in DATASET_DEFINITIONS.values()
    ]


@router.get("/{dataset_type}")
async def download_template(dataset_type: str) -> Response:
    """Genera y devuelve una plantilla Excel para el tipo de dataset solicitado."""
    try:
        definition = get_dataset_definition(dataset_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Plantilla"

    # Escribir encabezados con estilo
    for col_idx, header in enumerate(definition.all_columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = openpyxl.styles.Font(bold=True)
        cell.fill = openpyxl.styles.PatternFill(
            start_color="1E3A5F", end_color="1E3A5F", fill_type="solid"
        )
        cell.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = max(len(header) + 4, 16)

    # Guardar en memoria y devolver bytes completos para evitar ambiguedades en proxy/navegador
    buffer = BytesIO()
    wb.save(buffer)
    content = buffer.getvalue()

    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"plantilla_{definition.key}_{stamp}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
            ),
            "Content-Length": str(len(content)),
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Content-Type",
        },
    )

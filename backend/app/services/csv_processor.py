"""Validacion y parseo de CSVs por tipo de dataset."""
from __future__ import annotations

from typing import Any

import pandas as pd

from app.services.dataset_definitions import DatasetField, get_dataset_definition


def parse_and_validate(file_path: str, dataset_type: str) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Lee el CSV o Excel, valida columnas y tipos. Devuelve (df_valido, errores)."""
    definition = get_dataset_definition(dataset_type)

    file_lower = file_path.lower()
    if file_lower.endswith((".xlsx", ".xls")):
        df = pd.read_excel(file_path, dtype=str, keep_default_na=False, na_values=[""])
    else:
        df = pd.read_csv(file_path, dtype=str, keep_default_na=False, na_values=[""])

    df.columns = [str(column).strip().lower() for column in df.columns]

    required = set(definition.required_columns)
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Columnas faltantes en CSV: {sorted(missing)}")

    errors: list[dict[str, Any]] = []
    valid_rows: list[dict[str, Any]] = []
    available_fields = [field for field in definition.fields if field.name in df.columns]

    for idx, row in df.iterrows():
        normalized_row: dict[str, Any] = {}
        row_errors: list[dict[str, Any]] = []

        for field in available_fields:
            raw_value = row.get(field.name, "")
            value = "" if raw_value is None else str(raw_value).strip()
            parsed_value, error = _parse_field_value(field, value)
            if error:
                row_errors.append(
                    {
                        "row": int(idx) + 2,
                        "column": field.name,
                        "value": raw_value,
                        "error": error,
                    }
                )
                continue
            normalized_row[field.name] = parsed_value

        if row_errors:
            errors.extend(row_errors)
            continue

        valid_rows.append(normalized_row)

    return pd.DataFrame(valid_rows, columns=definition.all_columns), errors


def _parse_field_value(field: DatasetField, value: str) -> tuple[Any, str | None]:
    if value == "":
        if field.required:
            return None, "valor requerido"
        return None, None

    if field.kind == "string":
        normalized = value.lower() if field.allowed_values else value
        if field.allowed_values and normalized not in field.allowed_values:
            return None, f"debe ser uno de: {', '.join(field.allowed_values)}"
        return normalized, None

    if field.kind == "int":
        try:
            if "." in value:
                raise ValueError
            return int(value), None
        except ValueError:
            return None, "no es entero"

    if field.kind == "float":
        try:
            return float(value), None
        except ValueError:
            return None, "no es decimal"

    return None, "tipo de campo no soportado"

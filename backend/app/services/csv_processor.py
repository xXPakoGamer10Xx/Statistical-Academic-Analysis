"""Validacion y parseo de CSVs por tipo de dataset."""
from __future__ import annotations

from typing import Any

import pandas as pd

from app.services.dataset_definitions import DatasetField, get_dataset_definition


def parse_and_validate(file_path: str, dataset_type: str) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Lee el CSV o Excel, valida columnas y tipos. Devuelve (df_valido, errores)."""
    return parse_and_validate_smart(file_path, dataset_type)


def parse_and_validate_smart(
    file_path: str,
    dataset_type: str,
    sheet_name: str | None = None,
    header_row: int = 0,
    column_mapping: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Versión extendida que acepta configuración de mapeo. Retrocompatible con parse_and_validate."""
    file_lower = file_path.lower()
    if file_lower.endswith((".xlsx", ".xls")):
        read_kwargs: dict[str, Any] = {
            "dtype": str,
            "keep_default_na": False,
            "na_values": [""],
            "header": header_row,
        }
        if sheet_name:
            read_kwargs["sheet_name"] = sheet_name
        df = pd.read_excel(file_path, **read_kwargs)
    else:
        csv_kwargs: dict[str, Any] = {"dtype": str, "keep_default_na": False, "na_values": [""]}
        try:
            df = pd.read_csv(file_path, encoding="utf-8", **csv_kwargs)
        except UnicodeDecodeError:
            # Archivos exportados desde Excel/Windows usan latin-1 (ISO-8859-1).
            df = pd.read_csv(file_path, encoding="latin-1", **csv_kwargs)

    df = _apply_column_mapping(df, column_mapping)
    return _validate_dataframe(df, dataset_type)


def _apply_column_mapping(df: pd.DataFrame, column_mapping: dict[str, str] | None) -> pd.DataFrame:
    """Renombra columnas del Excel a nombres del sistema y normaliza."""
    if column_mapping:
        df = df.rename(columns=column_mapping)
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _validate_dataframe(
    df: pd.DataFrame, dataset_type: str
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Valida tipos y valores de un DataFrame ya con columnas normalizadas."""
    definition = get_dataset_definition(dataset_type)

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


def validate_rows(
    dataset_type: str, rows: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Valida filas capturadas a mano (lista de dicts). Devuelve (filas_válidas, errores).

    Reutiliza la misma validación por campo que la carga de archivos.
    """
    definition = get_dataset_definition(dataset_type)
    valid_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for idx, raw in enumerate(rows):
        lower = {str(k).strip().lower(): v for k, v in raw.items()}
        normalized: dict[str, Any] = {}
        row_errors: list[dict[str, Any]] = []

        for field in definition.fields:
            raw_value = lower.get(field.name, "")
            value = "" if raw_value is None else str(raw_value).strip()
            parsed_value, error = _parse_field_value(field, value)
            if error:
                row_errors.append(
                    {"row": idx + 1, "column": field.name, "value": raw_value, "error": error}
                )
                continue
            if parsed_value is not None:
                normalized[field.name] = parsed_value

        if row_errors:
            errors.extend(row_errors)
            continue
        valid_rows.append(normalized)

    return valid_rows, errors


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

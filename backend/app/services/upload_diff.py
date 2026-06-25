"""Comparación semántica entre una plantilla nueva y los datos actuales en BD."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dataset_definitions import get_dataset_definition
from app.workers.tasks import DEDUP_KEYS, MODEL_BY_TYPE

COMPARE_KEYS: dict[str, tuple[str, ...]] = {
    **DEDUP_KEYS,
    "evaluacion_academica": (
        "subsistema_id",
        "ciclo_escolar",
        "cuatrimestre",
        "programa_educativo",
    ),
    "evaluacion_docente": (
        "subsistema_id",
        "ciclo_escolar",
        "docente_id",
        "programa_educativo",
        "evaluador_tipo",
    ),
}

EXCLUDED_COMPARE_FIELDS = frozenset({"id", "uploaded_at"})
DEFAULT_DETAIL_LIMIT = 50


def get_compare_keys(dataset_type: str) -> tuple[str, ...]:
    keys = COMPARE_KEYS.get(dataset_type)
    if not keys:
        raise ValueError(f"Tipo de dataset sin llaves de comparación: {dataset_type}")
    return keys


def get_compare_fields(dataset_type: str) -> list[str]:
    definition = get_dataset_definition(dataset_type)
    return ["subsistema_id", *definition.all_columns]


def _normalize_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        normalized = format(value, "f")
        if "." in normalized:
            normalized = normalized.rstrip("0").rstrip(".")
        return normalized
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        normalized = format(value, "f")
        if "." in normalized:
            normalized = normalized.rstrip("0").rstrip(".")
        return normalized
    return str(value).strip()


def _row_key(row: dict[str, Any], keys: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(_normalize_value(row.get(key)) for key in keys)


def _key_dict(row: dict[str, Any], keys: tuple[str, ...]) -> dict[str, str]:
    return {key: _normalize_value(row.get(key)) for key in keys}


def _index_rows(rows: list[dict[str, Any]], keys: tuple[str, ...]) -> dict[tuple[str, ...], dict[str, Any]]:
    indexed: dict[tuple[str, ...], dict[str, Any]] = {}
    for row in rows:
        indexed[_row_key(row, keys)] = row
    return indexed


def _field_changes(
    old_row: dict[str, Any],
    new_row: dict[str, Any],
    compare_fields: list[str],
) -> list[dict[str, str | None]]:
    changes: list[dict[str, str | None]] = []
    for field in compare_fields:
        old_value = _normalize_value(old_row.get(field))
        new_value = _normalize_value(new_row.get(field))
        if old_value != new_value:
            changes.append(
                {
                    "field": field,
                    "old_value": old_value or None,
                    "new_value": new_value or None,
                }
            )
    return changes


def compare_upload_with_baseline(
    new_rows: list[dict[str, Any]],
    baseline_rows: list[dict[str, Any]],
    dataset_type: str,
    *,
    detail_limit: int = DEFAULT_DETAIL_LIMIT,
) -> dict[str, Any]:
    keys = get_compare_keys(dataset_type)
    compare_fields = [
        field for field in get_compare_fields(dataset_type) if field not in EXCLUDED_COMPARE_FIELDS
    ]

    new_index = _index_rows(new_rows, keys)
    baseline_index = _index_rows(baseline_rows, keys)

    added_keys = [key for key in new_index if key not in baseline_index]
    removed_keys = [key for key in baseline_index if key not in new_index]
    shared_keys = [key for key in new_index if key in baseline_index]

    modified: list[dict[str, Any]] = []
    unchanged_count = 0

    for key in shared_keys:
        changes = _field_changes(baseline_index[key], new_index[key], compare_fields)
        if changes:
            modified.append(
                {
                    "key": _key_dict(new_index[key], keys),
                    "changes": changes,
                }
            )
        else:
            unchanged_count += 1

    added = [{"key": _key_dict(new_index[key], keys)} for key in added_keys]
    removed = [{"key": _key_dict(baseline_index[key], keys)} for key in removed_keys]

    total_details = len(added) + len(removed) + len(modified)
    truncated = (
        len(added) > detail_limit
        or len(removed) > detail_limit
        or len(modified) > detail_limit
    )

    return {
        "summary": {
            "added": len(added),
            "removed": len(removed),
            "modified": len(modified),
            "unchanged": unchanged_count,
        },
        "added": added[:detail_limit],
        "removed": removed[:detail_limit],
        "modified": modified[:detail_limit],
        "truncated": truncated or total_details > detail_limit * 3,
    }


async def load_baseline_rows(
    db: AsyncSession,
    dataset_type: str,
    subsistema_id: int,
) -> list[dict[str, Any]]:
    model = MODEL_BY_TYPE[dataset_type]
    compare_fields = get_compare_fields(dataset_type)
    columns = [getattr(model, field) for field in compare_fields if hasattr(model, field)]

    stmt = select(*columns).where(model.subsistema_id == subsistema_id)
    result = await db.execute(stmt)
    rows: list[dict[str, Any]] = []
    for record in result.mappings().all():
        row = {field: record.get(field) for field in compare_fields if field in record}
        rows.append(row)
    return rows
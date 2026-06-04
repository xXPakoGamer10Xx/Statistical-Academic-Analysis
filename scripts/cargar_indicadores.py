"""
Script para cargar Indicadores Históricos al sistema.
Ejecutar dentro del contenedor backend:
  docker cp cargar_indicadores.py academia-stats-backend-1:/app/
  docker cp "Indicadores historicos 07-02-25 (2).xlsx" academia-stats-backend-1:/app/
  docker exec academia-stats-backend-1 python3 /app/cargar_indicadores.py
"""
from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime, UTC
from typing import Any

import openpyxl

# ── Conexión sincrónica (igual que el worker Celery) ─────────────────────────
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.matricula import Matricula
from app.models.evaluacion import EvaluacionAcademica, EvaluacionDocente
from app.models.titulacion import Titulacion
from sqlalchemy.dialects.postgresql import insert as pg_insert

EXCEL_PATH = "/app/Indicadores historicos 07-02-25 (2).xlsx"
SUBSISTEMA_ID = 5   # Universidades Politécnicas

engine = create_engine(settings.database_url_str, pool_pre_ping=True, future=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_id(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", "_", s.strip().lower())


def _parse_periodo(label: str) -> tuple[str, int] | tuple[None, None]:
    """Convierte etiqueta de periodo → (ciclo_escolar, cuatrimestre)."""
    label = str(label).strip()
    m = re.search(r"\d{4}", label)
    if not m:
        return None, None
    year = int(m.group())
    lo = label.lower()
    if any(x in lo for x in ["sep", "s-d", "sd"]):
        return f"{year}-{year + 1}", 1
    if any(x in lo for x in ["ene", "e-a", "ea"]):
        return f"{year - 1}-{year}", 2
    if any(x in lo for x in ["may", "m-a", "ma"]):
        return f"{year - 1}-{year}", 3
    return None, None


def _safe_int(v: Any) -> int:
    try:
        if v is None:
            return 0
        return int(float(str(v)))
    except Exception:
        return 0


def _safe_float(v: Any) -> float | None:
    try:
        if v is None:
            return None
        f = float(str(v))
        return round(f, 4)
    except Exception:
        return None


def _expand_merged(ws: Any) -> None:
    for rng in list(ws.merged_cells.ranges):
        val = ws.cell(rng.min_row, rng.min_col).value
        ws.unmerge_cells(str(rng))
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                ws.cell(r, c).value = val


def _row_vals(ws: Any, row: int) -> dict[int, Any]:
    """Devuelve {col_idx(0-based): value} para la fila dada (1-based)."""
    return {
        (cell.column - 1): cell.value
        for cell in ws[row]
        if cell.value is not None
    }


# ── 1. MATRÍCULA ─────────────────────────────────────────────────────────────

MATRICULA_SHEETS = {
    "Matricula 20-21": "2020-2021",
    "Matricula 21-22": "2021-2022",
    "Matricula 22-23": "2022-2023",
    "Matricula 23-24": "2023-2024",
    "Matricula 24-25": "2024-2025",
}

# Bajas y género disponibles solo a nivel agregado por periodo.
# Se reparten proporcionalmente por PE según su peso en la matrícula total.
# Para simplificar, se usa 0 en estos campos (pueden completarse después).


def extract_matricula(wb: openpyxl.Workbook) -> list[dict]:
    rows = []
    for sheet_name, ciclo_hint in MATRICULA_SHEETS.items():
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        _expand_merged(ws)

        # Encontrar fila de headers (buscar fila que tenga "PE")
        header_row_idx = None
        for r in ws.iter_rows(max_row=15):
            vals = [c.value for c in r if c.value is not None]
            if any(str(v).strip().upper() == "PE" for v in vals):
                header_row_idx = r[0].row
                break
        if header_row_idx is None:
            print(f"  [SKIP] {sheet_name}: no se encontró fila de headers")
            continue

        header = _row_vals(ws, header_row_idx)
        # Mapear col → (ciclo, cuatrimestre) para las columnas de periodo
        col_map: dict[int, tuple[str, int]] = {}
        for col_idx, val in header.items():
            if val is None or str(val).strip().upper() == "PE":
                continue
            ciclo, cuatrimestre = _parse_periodo(str(val))
            if ciclo and cuatrimestre:
                col_map[col_idx] = (ciclo, cuatrimestre)

        if not col_map:
            print(f"  [SKIP] {sheet_name}: no se pudieron parsear columnas de periodo")
            continue

        # Leer filas de PE
        for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
            pe = row[1] if len(row) > 1 else None  # PE está en la columna B (idx 1)
            if pe is None or str(pe).strip() in ("", "MATRICULA", "TOTAL"):
                continue
            pe = str(pe).strip()

            for col_idx, (ciclo, cuatrimestre) in col_map.items():
                total_val = row[col_idx] if col_idx < len(row) else None
                total = _safe_int(total_val)
                if total == 0:
                    continue

                rows.append({
                    "subsistema_id": SUBSISTEMA_ID,
                    "ciclo_escolar": ciclo,
                    "cuatrimestre": cuatrimestre,
                    "programa_educativo": pe,
                    "total": total,
                    "nuevo_ingreso": 0,
                    "bajas_reprobacion": 0,
                    "bajas_desercion": 0,
                    "hombres": 0,
                    "mujeres": 0,
                    "poblacion_edad_escolar": None,
                    "egresados_nms": None,
                })

    return rows


# ── 2. EVALUACIÓN ACADÉMICA (APROVECHAMIENTO) ─────────────────────────────────

# columna del PE: índice 1 (col B en Excel = índice 1 en 0-based)
# columnas de datos: año Y empieza en col 3 + (Y-2015)*3
# dentro del bloque: E-A=+0, M-A=+1, S-D=+2

APROVECHAMIENTO_YEARS = list(range(2015, 2025))

APROVECHAMIENTO_PE_ROWS = 7  # fila 7 en Excel (1-based) para LAGP


def extract_evaluacion_academica(wb: openpyxl.Workbook) -> list[dict]:
    if "APROVECHAMIENTO" not in wb.sheetnames:
        return []
    ws = wb["APROVECHAMIENTO"]
    _expand_merged(ws)

    rows = []
    # Los PE están en filas 7-13 (LAGP, IET, IRO, LAGE, LCI, ISC, ILT)
    # Buscamos filas donde col 1 tenga texto de PE
    pe_rows: list[tuple[int, str]] = []
    for r in ws.iter_rows(min_row=6, max_row=20):
        pe_val = r[1].value if len(r) > 1 else None
        if pe_val and isinstance(pe_val, str) and len(pe_val.strip()) <= 10 and pe_val.strip() not in ("", "LAGP", ) or (isinstance(pe_val, str) and re.match(r'^[A-Z]{2,6}$', pe_val.strip())):
            pe_rows.append((r[0].row, pe_val.strip()))

    if not pe_rows:
        # fallback: leer filas 7-13
        for r_idx in range(7, 14):
            row = list(ws.iter_rows(min_row=r_idx, max_row=r_idx, values_only=True))[0]
            pe_val = row[1] if len(row) > 1 else None
            if pe_val and isinstance(pe_val, str) and re.match(r'^[A-Z]{2,6}$', pe_val.strip()):
                pe_rows.append((r_idx, pe_val.strip()))

    for row_num, pe in pe_rows:
        row_data = list(ws.iter_rows(min_row=row_num, max_row=row_num, values_only=True))[0]

        for y_offset, year in enumerate(APROVECHAMIENTO_YEARS):
            base_col = 3 + y_offset * 3  # columna E-A de ese año (0-based)
            cuatrimestre_map = [
                (base_col,     year - 1, year, 2),   # E-A → ciclo (Y-1)-Y, C2
                (base_col + 1, year - 1, year, 3),   # M-A → ciclo (Y-1)-Y, C3
                (base_col + 2, year,     year + 1, 1), # S-D → ciclo Y-(Y+1), C1
            ]
            for col_idx, cy1, cy2, cuatrimestre in cuatrimestre_map:
                if col_idx >= len(row_data):
                    continue
                prom = _safe_float(row_data[col_idx])
                if prom is None or prom == 0.0:
                    continue
                rows.append({
                    "subsistema_id": SUBSISTEMA_ID,
                    "ciclo_escolar": f"{cy1}-{cy2}",
                    "cuatrimestre": cuatrimestre,
                    "programa_educativo": pe,
                    "promedio_pe": prom,
                    "num_pe": 1,
                })

    return rows


# ── 3. EVALUACIÓN DOCENTE ─────────────────────────────────────────────────────

EVAL_DOC_SHEETS = {
    "EVAL DOC CLIENTE E-A M-A 2020":        ("2019-2020", 2),
    "EVAL DOC CLIENTE Y RPE S-D 20":        ("2020-2021", 1),
    "EVAL DOC CLIENTE Y RPE E-A 21":        ("2020-2021", 2),
    "EVAL DOC CLIENTE Y RPE M-A 21":        ("2020-2021", 3),
    "EVAL DOC CLIENTE Y RPE E-A 22":        ("2021-2022", 2),
    "EVAL DOC CLIENTE Y RPE M-A 22":        ("2021-2022", 3),
    "EVAL DOC CLIENTE Y RPE  M-A 23":       ("2022-2023", 3),
    "EVAL DOC CLIENTE Y RPE  E-A 24":       ("2023-2024", 2),
    "EVAL DOC CLIENTE Y RPE  M-A 24":       ("2023-2024", 3),
}


def extract_evaluacion_docente(wb: openpyxl.Workbook) -> list[dict]:
    rows = []
    for sheet_name, (ciclo, cuatrimestre) in EVAL_DOC_SHEETS.items():
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]

        # Columnas fijas (0-based): 3=calif_gral, 4=nombre, 5=tipo, 6=estudiante, 7=rpe
        # Buscamos la fila de datos (donde col 4 sea un nombre de persona)
        for row in ws.iter_rows(min_row=3, values_only=True):
            if len(row) < 8:
                continue
            nombre = row[4]
            est_score = row[6]
            rpe_score = row[7]

            if not isinstance(nombre, str) or len(nombre.strip()) < 5:
                continue
            nombre = nombre.strip()

            docente_id = _normalize_id(nombre)

            est = _safe_float(est_score)
            rpe = _safe_float(rpe_score)

            if est is not None and est > 0:
                rows.append({
                    "subsistema_id": SUBSISTEMA_ID,
                    "ciclo_escolar": ciclo,
                    "docente_id": docente_id,
                    "docente_nombre": nombre,
                    "programa_educativo": "GENERAL",
                    "evaluador_tipo": "alumno",
                    "puntaje": est,
                })
            if rpe is not None and rpe > 0:
                rows.append({
                    "subsistema_id": SUBSISTEMA_ID,
                    "ciclo_escolar": ciclo,
                    "docente_id": docente_id,
                    "docente_nombre": nombre,
                    "programa_educativo": "GENERAL",
                    "evaluador_tipo": "directivo",
                    "puntaje": rpe,
                })
    return rows


# ── 4. TITULACIÓN ─────────────────────────────────────────────────────────────

def extract_titulacion(wb: openpyxl.Workbook) -> list[dict]:
    if "Titulados Histórico act" not in wb.sheetnames:
        return []
    ws = wb["Titulados Histórico act"]

    rows = []
    current_carrera: str | None = None

    for row in ws.iter_rows(min_row=15, values_only=True):
        if len(row) < 15:
            continue

        # col 1 (0-based) puede tener el nombre de carrera
        carrera_val = row[1]
        if carrera_val and isinstance(carrera_val, str) and len(carrera_val.strip()) > 5:
            current_carrera = carrera_val.strip()

        if current_carrera is None:
            continue

        ingreso_val = row[2]
        if not isinstance(ingreso_val, datetime):
            continue

        # col 6: INGRESO TOTAL
        matricula_gen = _safe_int(row[6])
        # col 11: EGRESADOS TOTAL (cohorte + rezagados)
        egresados_total = _safe_int(row[11])
        # col 14: TITULADOS TOTAL
        titulados_total = _safe_int(row[14])

        if matricula_gen == 0:
            continue

        generacion = f"{ingreso_val.year}-{ingreso_val.strftime('%m')}"

        rows.append({
            "subsistema_id": SUBSISTEMA_ID,
            "generacion": generacion,
            "programa_educativo": current_carrera,
            "matricula_generacional": matricula_gen,
            "concluyeron_estudios": egresados_total,
            "egresados": egresados_total,
            "titulados": titulados_total,
            "ingresados_ns": None,
        })

    return rows


# ── Inserción en base de datos ────────────────────────────────────────────────

def _dedup_rows(rows: list[dict], keys: list[str]) -> list[dict]:
    """Elimina duplicados de la lista manteniendo el último valor por clave compuesta."""
    seen: dict[tuple, dict] = {}
    for row in rows:
        k = tuple(row[key] for key in keys)
        seen[k] = row
    return list(seen.values())


def upsert_matricula(session: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    rows = _dedup_rows(rows, ["subsistema_id", "ciclo_escolar", "cuatrimestre", "programa_educativo"])
    stmt = pg_insert(Matricula.__table__).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_matricula_periodo",
        set_={c: stmt.excluded[c] for c in [
            "total", "nuevo_ingreso", "bajas_reprobacion", "bajas_desercion",
            "hombres", "mujeres",
        ]},
    )
    return session.execute(stmt).rowcount or len(rows)


def insert_eval_academica(session: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    # Primero borrar los existentes del mismo subsistema para evitar duplicados
    session.execute(
        text("DELETE FROM evaluacion_academica WHERE subsistema_id = :sid"),
        {"sid": SUBSISTEMA_ID}
    )
    stmt = pg_insert(EvaluacionAcademica.__table__).values(rows)
    session.execute(stmt)
    return len(rows)


def insert_eval_docente(session: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    session.execute(
        text("DELETE FROM evaluacion_docente WHERE subsistema_id = :sid"),
        {"sid": SUBSISTEMA_ID}
    )
    stmt = pg_insert(EvaluacionDocente.__table__).values(rows)
    session.execute(stmt)
    return len(rows)


def upsert_titulacion(session: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    stmt = pg_insert(Titulacion.__table__).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_titulacion_generacion",
        set_={c: stmt.excluded[c] for c in [
            "matricula_generacional", "concluyeron_estudios", "egresados", "titulados",
        ]},
    )
    return session.execute(stmt).rowcount or len(rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"\n{'='*60}")
    print(f"Cargando: {EXCEL_PATH}")
    print(f"Subsistema ID: {SUBSISTEMA_ID}")
    print(f"{'='*60}\n")

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

    print("Extrayendo datos...")
    matricula_rows = extract_matricula(wb)
    eval_acad_rows = extract_evaluacion_academica(wb)
    eval_doc_rows  = extract_evaluacion_docente(wb)
    tit_rows       = extract_titulacion(wb)

    print(f"  Matrícula:           {len(matricula_rows)} registros")
    print(f"  Eval. Académica:     {len(eval_acad_rows)} registros")
    print(f"  Eval. Docente:       {len(eval_doc_rows)} registros")
    print(f"  Titulación:          {len(tit_rows)} registros")

    print("\nInsertando en base de datos...")
    with Session(engine) as session:
        try:
            n1 = upsert_matricula(session, matricula_rows)
            print(f"  ✓ Matrícula:       {n1} filas")

            n2 = insert_eval_academica(session, eval_acad_rows)
            print(f"  ✓ Eval. Académica: {n2} filas")

            n3 = insert_eval_docente(session, eval_doc_rows)
            print(f"  ✓ Eval. Docente:   {n3} filas")

            n4 = upsert_titulacion(session, tit_rows)
            print(f"  ✓ Titulación:      {n4} filas")

            session.commit()
            print("\n✅ Carga completada exitosamente.")
        except Exception as exc:
            session.rollback()
            print(f"\n❌ Error: {exc}")
            raise


if __name__ == "__main__":
    main()

"""Catalogo de carreras de UPTex (subsistema_id=5) para el ETL de datos historicos.

Unifica los codigos/nombres usados en distintas hojas del Excel institucional
("Examen Admision", "Matricula por cuatrimestre", "Titulados Historico act", etc.)
bajo un nombre final por carrera, siguiendo la decision confirmada con el usuario:
los programas "Nuevo plan" (2024-2025) reemplazan al programa viejo (mismo alumnado,
solo cambia nombre/plan de estudios), asi que su historico se une en una sola serie.

El mapeo "codigo Nuevo plan -> nombre completo" se dedujo cruzando los NUMEROS de la
hoja "Examen Admision" (columnas 44-51, tabla de planeacion de admision 2024-2025):
la fila de cada codigo corto (ISE, IMC, LAD, LCI, ITIID, ILG) tiene los mismos 5
numeros (grupos/estudiantes proyectados, 1a ronda, faltan, ofertados 2a) que alguna
fila de la tabla de nombres completos "(Nuevo plan)" -- se emparejaron por esos
numeros identicos, no por posicion de fila (la hoja tiene las 2 tablas desalineadas
verticalmente).
"""
from __future__ import annotations

import re

# codigo/variante (Excel) -> nombre final unificado (el que se guarda en programa_educativo)
CARRERA_CANONICA: dict[str, str] = {
    "IET": "INGENIERÍA EN SISTEMAS ELECTRÓNICOS",
    "ISE": "INGENIERÍA EN SISTEMAS ELECTRÓNICOS",
    "IRO": "INGENIERÍA MECATRÓNICA",
    "IMC": "INGENIERÍA MECATRÓNICA",
    "LAGE": "LICENCIATURA EN ADMINISTRACIÓN",
    "LAD": "LICENCIATURA EN ADMINISTRACIÓN",
    "LADM": "LICENCIATURA EN ADMINISTRACIÓN",
    "ISC": "TECNOLOGÍAS DE LA INFORMACIÓN E INNOVACIÓN DIGITAL",
    "ITID": "TECNOLOGÍAS DE LA INFORMACIÓN E INNOVACIÓN DIGITAL",
    "ITIID": "TECNOLOGÍAS DE LA INFORMACIÓN E INNOVACIÓN DIGITAL",
    "ILT": "INGENIERÍA EN LOGÍSTICA",
    "ILG": "INGENIERÍA EN LOGÍSTICA",
    "LCI": "LICENCIATURA EN COMERCIO INTERNACIONAL Y ADUANAS",
    "LCIA": "LICENCIATURA EN COMERCIO INTERNACIONAL Y ADUANAS",
}

# LAGP: programa descontinuado ~2020, ningun nombre completo aparece en el Excel.
# Se excluye del merge y se reporta aparte para que el usuario confirme el nombre real
# antes de cargarlo (no se inventa un nombre).
CODIGO_SIN_NOMBRE_CONFIRMADO = {"LAGP"}


def carrera_por_codigo(codigo: str) -> str | None:
    """Nombre final para un codigo corto de PE (ej. 'IET', 'ISE'). None si no se debe cargar."""
    codigo = codigo.strip().upper()
    if codigo in CODIGO_SIN_NOMBRE_CONFIRMADO:
        return None
    return CARRERA_CANONICA.get(codigo)


def normalize_carrera_fullname(raw: str) -> str | None:
    """Nombre final para un nombre completo (con posibles erratas) tal como aparece en
    hojas como 'Titulados Historico act' (ej. 'LICENICTAURA EN ADMINISTRACION...').
    None si no se reconoce ninguna carrera conocida en el texto.
    """
    s = raw.upper().strip()
    s = re.sub(r"\s+", " ", s)
    if "ADMINISTRACI" in s:
        return "LICENCIATURA EN ADMINISTRACIÓN"
    if "ELECTR" in s and ("TELECOM" in s or "ELECTRÓNICA" in s or "ELECTRONICA" in s):
        return "INGENIERÍA EN SISTEMAS ELECTRÓNICOS"
    if "ROB" in s:
        return "INGENIERÍA MECATRÓNICA"
    if "COMERCIO INTERNACIONAL" in s:
        return "LICENCIATURA EN COMERCIO INTERNACIONAL Y ADUANAS"
    if "SISTEMAS COMPUTACIONALES" in s:
        return "TECNOLOGÍAS DE LA INFORMACIÓN E INNOVACIÓN DIGITAL"
    if "LOG" in s and ("STICA" in s or "ISTICA" in s):
        return "INGENIERÍA EN LOGÍSTICA"
    return None

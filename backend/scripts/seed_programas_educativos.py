"""Siembra el catálogo de carreras (programas_educativos) de UPTex (subsistema_id=5):
las 6 carreras profesionales ya existentes en el sistema, emparejadas con su TSU
correspondiente (dato proporcionado por el usuario, nunca antes capturado en ningún
lado del sistema ni del Excel institucional).

Por defecto corre en modo DRY-RUN. Usar --apply para escribir de verdad.
"""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.programa_educativo import ProgramaEducativo

SUBSISTEMA_ID = 5

# (nombre profesional -> nombre TSU par), nombres profesionales iguales a los ya
# usados en matricula/titulacion/evaluacion_academica para esta escuela.
PARES: list[tuple[str, str]] = [
    ("INGENIERÍA EN SISTEMAS ELECTRÓNICOS", "TSU EN REDES DE COMUNICACIÓN"),
    ("INGENIERÍA EN LOGÍSTICA", "TSU EN CADENA DE SUMINISTRO"),
    ("INGENIERÍA MECATRÓNICA", "TSU EN AUTOMATIZACIÓN"),
    ("LICENCIATURA EN ADMINISTRACIÓN", "TSU EN EMPRENDIMIENTO, FORMULACIÓN Y EVALUACIÓN DE PROYECTOS"),
    ("TECNOLOGÍAS DE LA INFORMACIÓN E INNOVACIÓN DIGITAL", "TSU EN INFRAESTRUCTURA EN REDES DIGITALES"),
    ("LICENCIATURA EN COMERCIO INTERNACIONAL Y ADUANAS", "TSU EN LICENCIATURA EN COMERCIO INTERNACIONAL Y ADUANAS"),
]


async def run(apply: bool) -> None:
    print(f"{'PROFESIONAL':<55} {'TSU':<60}")
    for profesional, tsu in PARES:
        print(f"{profesional:<55} {tsu:<60}")
    print(f"\nTotal pares: {len(PARES)} (12 carreras)")

    if not apply:
        print("\n[DRY RUN] No se escribió nada. Corre con --apply para cargar de verdad.")
        return

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(
            select(ProgramaEducativo).where(ProgramaEducativo.subsistema_id == SUBSISTEMA_ID)
        )).scalars().all()
        if existing:
            print(f"\n[ABORTADO] Ya existen {len(existing)} carreras en el catálogo para "
                  f"subsistema_id={SUBSISTEMA_ID}. Bórralas primero si quieres re-sembrar.")
            return

        for profesional, tsu in PARES:
            prof_row = ProgramaEducativo(
                subsistema_id=SUBSISTEMA_ID, nombre=profesional, nivel="profesional"
            )
            tsu_row = ProgramaEducativo(
                subsistema_id=SUBSISTEMA_ID, nombre=tsu, nivel="tsu"
            )
            db.add_all([prof_row, tsu_row])
            await db.flush()  # asigna IDs
            prof_row.carrera_par_id = tsu_row.id
            tsu_row.carrera_par_id = prof_row.id

        await db.commit()
        print(f"\n[APLICADO] {len(PARES) * 2} carreras creadas y emparejadas.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.apply))


if __name__ == "__main__":
    main()

"""Sincroniza el catálogo administrable ciclos_generacionales con los valores reales
ya presentes en evaluacion_academica/titulacion para UPTex (subsistema_id=5), cargados
por el ETL histórico. El catálogo tenía solo 4 generaciones genéricas de demo y le
faltaban 5 años de ciclo escolar: eso hacía que el selector de Eficiencia mostrara
generaciones inexistentes ("2019-2023 que no he agregado") y ocultara ciclos reales.

Agrega (activas) las 12 generaciones reales y los 5 ciclos escolares que faltan
(2014-2015 a 2018-2019); reactiva "2018-2022" (ya existía mal cargada como inactiva).
No borra ni desactiva ningún valor existente — solo agrega lo que falta.

Por defecto corre en modo DRY-RUN. Usar --apply para escribir de verdad.
"""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.ciclo_generacional import CicloGeneracional

GENERACIONES: list[str] = [
    "2011-2014", "2012-2015", "2013-2016", "2014-2017", "2015-2018",
    "2016-2019", "2017-2020", "2017-2021", "2018-2022", "2019-2023",
    "2020-2024", "2021-2025",
]

CICLOS: list[str] = [
    "2014-2015", "2015-2016", "2016-2017", "2017-2018", "2018-2019",
]


async def run(apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        existentes = (await db.execute(select(CicloGeneracional))).scalars().all()
        por_clave = {(c.tipo, c.valor): c for c in existentes}

        faltantes: list[tuple[str, str]] = []
        reactivar: list[CicloGeneracional] = []

        for valor in GENERACIONES:
            actual = por_clave.get(("generacion", valor))
            if actual is None:
                faltantes.append(("generacion", valor))
            elif not actual.activo:
                reactivar.append(actual)

        for valor in CICLOS:
            actual = por_clave.get(("ciclo", valor))
            if actual is None:
                faltantes.append(("ciclo", valor))
            elif not actual.activo:
                reactivar.append(actual)

        print(f"Por agregar ({len(faltantes)}):")
        for tipo, valor in faltantes:
            print(f"  + {tipo:<11} {valor}")
        print(f"\nPor reactivar ({len(reactivar)}):")
        for c in reactivar:
            print(f"  ~ {c.tipo:<11} {c.valor} (estaba inactivo)")

        if not faltantes and not reactivar:
            print("\nNada que hacer, el catálogo ya está sincronizado.")
            return

        if not apply:
            print("\n[DRY RUN] No se escribió nada. Corre con --apply para aplicar de verdad.")
            return

        for c in reactivar:
            c.activo = True
        for tipo, valor in faltantes:
            db.add(CicloGeneracional(tipo=tipo, valor=valor, activo=True))

        await db.commit()
        print(f"\n[APLICADO] {len(faltantes)} agregados, {len(reactivar)} reactivados.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.apply))


if __name__ == "__main__":
    main()

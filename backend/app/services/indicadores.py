"""Cálculo de indicadores académicos según fórmulas oficiales.

Fórmulas (de la matriz institucional):
- Matrícula = Matrícula Actual - Bajas por Reprobación - Bajas por Deserción + Nuevo Ingreso
- Aprovechamiento = Promedio de Evaluaciones de cada PE / Número de PE
- Reprobación = (Bajas por Reprobación * 100) / Matrícula Actual
- Deserción = (Bajas por Deserción * 100) / Matrícula Actual
- Eficiencia Terminal = (Estudiantes que concluyen estudios * 100) / Matrícula Generacional
- Índice de Titulación = (Egresados que obtienen título * 100) / Estudiantes que concluyeron
- Cobertura = Alumnos matriculados / Población en edad escolar
- Abandono Escolar = % alumnos que dejan la escuela durante un ciclo
- Absorción = Egresados de NMS / Estudiantes que ingresan al NS
"""
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.evaluacion import EvaluacionAcademica, EvaluacionDocente
from app.models.matricula import Matricula
from app.models.titulacion import Titulacion
from app.services.formulas import calculate_matricula_actual, calculate_percentage
from app.schemas.indicadores import (
    EficienciaPunto,
    EficienciaResumen,
    EvaluacionDocentePunto,
    EvaluacionDocenteResumen,
    IndicadoresOpcionales,
    IndicadorPorcentual,
    MatriculaPunto,
    MatriculaResumen,
    RendimientoResumen,
)


def _apply_filters(query, model, subsistema_id, ciclo_escolar=None, programa_educativo=None, cuatrimestre=None):
    conditions = []
    if subsistema_id is not None:
        conditions.append(model.subsistema_id == subsistema_id)
    if ciclo_escolar is not None:
        conditions.append(model.ciclo_escolar == ciclo_escolar)
    if programa_educativo is not None:
        conditions.append(model.programa_educativo == programa_educativo)
    if cuatrimestre is not None and hasattr(model, "cuatrimestre"):
        conditions.append(model.cuatrimestre == cuatrimestre)
    if conditions:
        query = query.where(and_(*conditions))
    return query


async def calcular_matricula(
    db: AsyncSession,
    subsistema_id: int | None,
    ciclo_escolar: str | None = None,
    cuatrimestre: int | None = None,
    programa_educativo: str | None = None,
) -> MatriculaResumen:
    query = select(Matricula).order_by(Matricula.ciclo_escolar, Matricula.cuatrimestre)
    query = _apply_filters(query, Matricula, subsistema_id, ciclo_escolar, programa_educativo, cuatrimestre)
    result = await db.execute(query)
    rows = result.scalars().all()

    series = [
        MatriculaPunto(
            ciclo_escolar=r.ciclo_escolar,
            cuatrimestre=r.cuatrimestre,
            programa_educativo=r.programa_educativo,
            matricula_actual=calculate_matricula_actual(
                r.total,
                r.bajas_reprobacion,
                r.bajas_desercion,
                r.nuevo_ingreso,
            ),
            nuevo_ingreso=r.nuevo_ingreso,
            hombres=r.hombres,
            mujeres=r.mujeres,
        )
        for r in rows
    ]

    total_hombres = sum(p.hombres for p in series)
    total_mujeres = sum(p.mujeres for p in series)

    return MatriculaResumen(
        total_actual=sum(p.matricula_actual for p in series),
        total_nuevo_ingreso=sum(p.nuevo_ingreso for p in series),
        distribucion_genero={"hombres": total_hombres, "mujeres": total_mujeres},
        series=series,
    )


async def calcular_rendimiento(
    db: AsyncSession,
    subsistema_id: int | None,
    ciclo_escolar: str | None = None,
    programa_educativo: str | None = None,
) -> RendimientoResumen:
    # Aprovechamiento: promedio de promedios por PE
    aprov_query = select(
        EvaluacionAcademica.ciclo_escolar,
        EvaluacionAcademica.programa_educativo,
        (func.sum(EvaluacionAcademica.promedio_pe * EvaluacionAcademica.num_pe)
         / func.sum(EvaluacionAcademica.num_pe)).label("valor"),
    ).group_by(EvaluacionAcademica.ciclo_escolar, EvaluacionAcademica.programa_educativo)
    aprov_query = _apply_filters(
        aprov_query, EvaluacionAcademica, subsistema_id, ciclo_escolar, programa_educativo
    )
    aprov_rows = (await db.execute(aprov_query)).all()

    # Reprobación y deserción se calculan desde matrícula
    mat_query = select(
        Matricula.ciclo_escolar,
        Matricula.programa_educativo,
        func.sum(Matricula.total).label("total"),
        func.sum(Matricula.bajas_reprobacion).label("rep"),
        func.sum(Matricula.bajas_desercion).label("des"),
    ).group_by(Matricula.ciclo_escolar, Matricula.programa_educativo)
    mat_query = _apply_filters(
        mat_query, Matricula, subsistema_id, ciclo_escolar, programa_educativo
    )
    mat_rows = (await db.execute(mat_query)).all()

    aprovechamiento = [
        IndicadorPorcentual(
            ciclo_escolar=r.ciclo_escolar,
            programa_educativo=r.programa_educativo,
            valor=float(r.valor) if r.valor else 0.0,
        )
        for r in aprov_rows
    ]
    reprobacion = [
        IndicadorPorcentual(
            ciclo_escolar=r.ciclo_escolar,
            programa_educativo=r.programa_educativo,
            valor=calculate_percentage(r.rep, r.total),
        )
        for r in mat_rows
    ]
    desercion = [
        IndicadorPorcentual(
            ciclo_escolar=r.ciclo_escolar,
            programa_educativo=r.programa_educativo,
            valor=calculate_percentage(r.des, r.total),
        )
        for r in mat_rows
    ]

    return RendimientoResumen(
        aprovechamiento=aprovechamiento,
        reprobacion=reprobacion,
        desercion=desercion,
    )


async def calcular_eficiencia(
    db: AsyncSession,
    subsistema_id: int | None,
    generaciones: list[str] | None = None,
    programa_educativo: str | None = None,
) -> EficienciaResumen:
    query = select(Titulacion).order_by(Titulacion.generacion.desc())
    conditions = []
    if subsistema_id is not None:
        conditions.append(Titulacion.subsistema_id == subsistema_id)
    if generaciones:
        conditions.append(Titulacion.generacion.in_(generaciones))
    if programa_educativo:
        conditions.append(Titulacion.programa_educativo == programa_educativo)
    if conditions:
        query = query.where(and_(*conditions))

    rows = (await db.execute(query)).scalars().all()

    puntos = [
        EficienciaPunto(
            generacion=r.generacion,
            programa_educativo=r.programa_educativo,
            eficiencia_terminal=calculate_percentage(
                r.concluyeron_estudios,
                r.matricula_generacional,
            ),
            indice_titulacion=calculate_percentage(r.titulados, r.concluyeron_estudios),
            egresados=r.egresados,
            titulados=r.titulados,
        )
        for r in rows
    ]
    return EficienciaResumen(generaciones=puntos)


async def calcular_evaluacion_docente(
    db: AsyncSession,
    subsistema_id: int | None,
    ciclo_escolar: str | None = None,
    programa_educativo: str | None = None,
) -> EvaluacionDocenteResumen:
    query = select(
        EvaluacionDocente.ciclo_escolar,
        EvaluacionDocente.docente_id,
        EvaluacionDocente.docente_nombre,
        EvaluacionDocente.programa_educativo,
        EvaluacionDocente.evaluador_tipo,
        func.avg(EvaluacionDocente.puntaje).label("promedio"),
    ).group_by(
        EvaluacionDocente.ciclo_escolar,
        EvaluacionDocente.docente_id,
        EvaluacionDocente.docente_nombre,
        EvaluacionDocente.programa_educativo,
        EvaluacionDocente.evaluador_tipo,
    )
    query = _apply_filters(
        query, EvaluacionDocente, subsistema_id, ciclo_escolar, programa_educativo
    )
    rows = (await db.execute(query)).all()

    agrupados: dict[tuple[str, str, str, str], dict[str, float]] = {}
    nombres: dict[str, str] = {}
    for r in rows:
        key = (r.ciclo_escolar, r.docente_id, r.docente_nombre, r.programa_educativo)
        nombres[r.docente_id] = r.docente_nombre
        bucket = agrupados.setdefault(key, {})
        bucket[r.evaluador_tipo] = float(r.promedio) if r.promedio else 0.0

    def _promedio_general(v: dict[str, float]) -> float | None:
        # Promedio general por docente = media de los promedios disponibles (alumnos y/o directivos)
        valores = [v[t] for t in ("alumno", "directivo") if v.get(t) is not None]
        return round(sum(valores) / len(valores), 2) if valores else None

    docentes = [
        EvaluacionDocentePunto(
            ciclo_escolar=k[0],
            docente_id=k[1],
            docente_nombre=k[2],
            programa_educativo=k[3],
            promedio_alumnos=v.get("alumno"),
            promedio_directivos=v.get("directivo"),
            promedio_general=_promedio_general(v),
        )
        for k, v in agrupados.items()
    ]

    generales = [d.promedio_general for d in docentes if d.promedio_general is not None]
    promedio_institucional = round(sum(generales) / len(generales), 2) if generales else None

    return EvaluacionDocenteResumen(
        docentes=docentes,
        promedio_institucional=promedio_institucional,
    )


async def calcular_indicadores_opcionales(
    db: AsyncSession,
    subsistema_id: int | None,
    ciclo_escolar: str | None = None,
) -> IndicadoresOpcionales:
    query = select(
        Matricula.ciclo_escolar,
        Matricula.programa_educativo,
        func.sum(Matricula.total).label("total"),
        func.sum(Matricula.bajas_desercion).label("des"),
        func.sum(Matricula.poblacion_edad_escolar).label("pob"),
        func.sum(Matricula.egresados_nms).label("egr_nms"),
        func.sum(Matricula.nuevo_ingreso).label("nuevo"),
    ).group_by(Matricula.ciclo_escolar, Matricula.programa_educativo)
    query = _apply_filters(query, Matricula, subsistema_id, ciclo_escolar)
    rows = (await db.execute(query)).all()

    cobertura = [
        IndicadorPorcentual(
            ciclo_escolar=r.ciclo_escolar,
            programa_educativo=r.programa_educativo,
            valor=calculate_percentage(r.total, r.pob),
        )
        for r in rows if r.pob
    ]
    abandono = [
        IndicadorPorcentual(
            ciclo_escolar=r.ciclo_escolar,
            programa_educativo=r.programa_educativo,
            valor=calculate_percentage(r.des, r.total),
        )
        for r in rows
    ]
    absorcion = [
        IndicadorPorcentual(
            ciclo_escolar=r.ciclo_escolar,
            programa_educativo=r.programa_educativo,
            valor=calculate_percentage(r.egr_nms, r.nuevo),
        )
        for r in rows if r.egr_nms
    ]
    return IndicadoresOpcionales(
        cobertura=cobertura, abandono_escolar=abandono, absorcion=absorcion
    )

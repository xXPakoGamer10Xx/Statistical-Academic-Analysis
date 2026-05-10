from pydantic import BaseModel


class MatriculaPunto(BaseModel):
    ciclo_escolar: str
    cuatrimestre: int
    programa_educativo: str
    matricula_actual: int
    nuevo_ingreso: int
    hombres: int
    mujeres: int


class MatriculaResumen(BaseModel):
    total_actual: int
    total_nuevo_ingreso: int
    distribucion_genero: dict[str, int]
    series: list[MatriculaPunto]


class IndicadorPorcentual(BaseModel):
    ciclo_escolar: str
    programa_educativo: str
    valor: float


class RendimientoResumen(BaseModel):
    aprovechamiento: list[IndicadorPorcentual]
    reprobacion: list[IndicadorPorcentual]
    desercion: list[IndicadorPorcentual]


class EficienciaPunto(BaseModel):
    generacion: str
    programa_educativo: str
    eficiencia_terminal: float
    indice_titulacion: float
    egresados: int
    titulados: int


class EficienciaResumen(BaseModel):
    generaciones: list[EficienciaPunto]


class EvaluacionDocentePunto(BaseModel):
    ciclo_escolar: str
    docente_id: str
    docente_nombre: str
    programa_educativo: str
    promedio_alumnos: float | None
    promedio_directivos: float | None


class EvaluacionDocenteResumen(BaseModel):
    docentes: list[EvaluacionDocentePunto]


class IndicadoresOpcionales(BaseModel):
    cobertura: list[IndicadorPorcentual]
    abandono_escolar: list[IndicadorPorcentual]
    absorcion: list[IndicadorPorcentual]

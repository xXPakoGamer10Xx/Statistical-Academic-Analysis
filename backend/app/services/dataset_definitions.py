from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


FieldKind = Literal["string", "int", "float"]
DatasetType = Literal[
    "matricula",
    "nuevo_ingreso",
    "evaluacion_academica",
    "titulacion",
    "evaluacion_docente",
    "becas",
    "discapacidad",
    "etnia",
]


@dataclass(frozen=True)
class DatasetField:
    name: str
    kind: FieldKind
    required: bool = True
    description: str | None = None
    # allowed_values: valores ESTRICTOS (se rechaza cualquier otro valor).
    allowed_values: tuple[str, ...] | None = None
    # suggested_values: catalogo SUGERIDO (el usuario puede elegir uno o escribir el suyo).
    suggested_values: tuple[str, ...] | None = None
    # max_value: limite superior para campos int/float (ej. puntaje de 1 a 10). Sin limite si es None.
    max_value: float | None = None
    # min_value: limite inferior para campos int/float. Si es None, el piso implicito es 0
    # (ningun campo del sistema admite negativos).
    min_value: float | None = None


# ---------------------------------------------------------------------------
# Catalogos estandar sugeridos. Son sugerencias: el usuario puede elegir de la lista
# o capturar texto libre.
# ---------------------------------------------------------------------------

TIPOS_BECA: tuple[str, ...] = (
    "Manutencion",
    "Excelencia",
    "Apoyo Indigena",
    "Deportiva",
    "Movilidad",
    "Titulacion",
    "Apoyo Discapacidad",
    "Madres solteras",
    "Otra",
)

SEXOS: tuple[str, ...] = ("Hombre", "Mujer")

CATALOGOS_CARACTERIZACION: dict[str, tuple[str, ...]] = {
    "discapacidad": (
        "Motriz",
        "Visual",
        "Auditiva",
        "Intelectual",
        "Psicosocial",
        "Del habla",
        "Multiple",
        "Otra",
    ),
    "etnia": (
        "Nahuatl",
        "Otomi",
        "Mazahua",
        "Matlatzinca",
        "Tlahuica",
        "Mixteco",
        "Zapoteco",
        "Maya",
        "Mixe",
        "Otra",
    ),
}


@dataclass(frozen=True)
class DatasetDefinition:
    key: DatasetType
    label: str
    description: str
    fields: tuple[DatasetField, ...]
    # Catalogos sugeridos por valor de una columna (ej. tipo segun categoria).
    catalogos: dict[str, tuple[str, ...]] | None = None

    @property
    def required_columns(self) -> list[str]:
        return [field.name for field in self.fields if field.required]

    @property
    def optional_columns(self) -> list[str]:
        return [field.name for field in self.fields if not field.required]

    @property
    def all_columns(self) -> list[str]:
        return [field.name for field in self.fields]


DATASET_DEFINITIONS: dict[DatasetType, DatasetDefinition] = {
    "matricula": DatasetDefinition(
        key="matricula",
        label="Matricula",
        description="Bajas por reprobacion/desercion y distribucion por sexo, por programa, cuatrimestre y ciclo.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("cuatrimestre", "int", min_value=0, max_value=3),
            DatasetField("programa_educativo", "string"),
            DatasetField("bajas_reprobacion", "int"),
            DatasetField("bajas_desercion", "int"),
            DatasetField("hombres", "int"),
            DatasetField("mujeres", "int"),
            DatasetField("poblacion_edad_escolar", "int", required=False),
        ),
    ),
    "nuevo_ingreso": DatasetDefinition(
        key="nuevo_ingreso",
        label="Nuevo Ingreso",
        description="Alumnos de nuevo ingreso por tipo de admision (examen, pase directo, RENOES), por programa, cuatrimestre y ciclo.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("cuatrimestre", "int", min_value=0, max_value=3),
            DatasetField("programa_educativo", "string"),
            DatasetField("ingreso_examen", "int", description="Alumnos de nuevo ingreso admitidos por examen."),
            DatasetField("ingreso_pase_directo", "int", description="Alumnos de nuevo ingreso admitidos por pase directo."),
            DatasetField("ingreso_renoes", "int", description="Alumnos de nuevo ingreso admitidos por RENOES."),
        ),
    ),
    "evaluacion_academica": DatasetDefinition(
        key="evaluacion_academica",
        label="Evaluacion Academica",
        description="Promedio general del programa educativo y numero de PE evaluados.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("cuatrimestre", "int", min_value=0, max_value=3),
            DatasetField("programa_educativo", "string"),
            DatasetField("promedio_pe", "float"),
            DatasetField("num_pe", "int"),
        ),
    ),
    "titulacion": DatasetDefinition(
        key="titulacion",
        label="Titulacion",
        description="Datos de generaciones egresadas: matricula inicial, quienes concluyeron y titulados.",
        fields=(
            DatasetField("generacion", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField("egresados", "int"),
            DatasetField("titulados", "int"),
        ),
    ),
    "evaluacion_docente": DatasetDefinition(
        key="evaluacion_docente",
        label="Evaluacion Docente",
        description="Puntajes de evaluacion por docente. Un registro por evaluador por docente.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField(
                "puesto",
                "string",
                allowed_values=("P.A.", "P.C."),
                description="Puesto del docente. Valores permitidos: P.A. (Profesor de Asignatura) o P.C. (Profesor de Carrera).",
            ),
            DatasetField("docente_nombre", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField(
                "evaluador_tipo",
                "string",
                allowed_values=("alumno", "directivo"),
                description="Valores permitidos: alumno o directivo.",
            ),
            DatasetField(
                "puntaje",
                "float",
                description="Puntaje de evaluacion, escala 1-10.",
                min_value=1,
                max_value=10,
            ),
        ),
    ),
    "becas": DatasetDefinition(
        key="becas",
        label="Becas",
        description=(
            "Desglose del alumnado becado por tipo de beca. "
            "Un registro por cada tipo, con la cantidad de alumnos por programa y ciclo."
        ),
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField(
                "tipo",
                "string",
                description="Tipo de beca. Valores permitidos: " + ", ".join(TIPOS_BECA) + ".",
                allowed_values=TIPOS_BECA,
            ),
            DatasetField(
                "sexo",
                "string",
                allowed_values=SEXOS,
                description="Sexo del alumnado becado. Valores permitidos: Hombre o Mujer.",
            ),
            DatasetField("cantidad", "int", description="Numero de alumnos becados de ese tipo."),
        ),
    ),
    "discapacidad": DatasetDefinition(
        key="discapacidad",
        label="Discapacidad",
        description=(
            "Desglose del alumnado con discapacidad por tipo. "
            "Un registro por cada tipo, con la cantidad de alumnos por programa y ciclo."
        ),
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField(
                "tipo",
                "string",
                description=(
                    "Tipo de discapacidad. Valores permitidos: "
                    + ", ".join(CATALOGOS_CARACTERIZACION["discapacidad"])
                    + "."
                ),
                allowed_values=CATALOGOS_CARACTERIZACION["discapacidad"],
            ),
            DatasetField(
                "sexo",
                "string",
                allowed_values=SEXOS,
                description="Sexo del alumnado. Valores permitidos: Hombre o Mujer.",
            ),
            DatasetField("cantidad", "int", description="Numero de alumnos de ese tipo."),
        ),
    ),
    "etnia": DatasetDefinition(
        key="etnia",
        label="Etnia",
        description=(
            "Desglose del alumnado por etnia. "
            "Un registro por cada tipo, con la cantidad de alumnos por programa y ciclo."
        ),
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField(
                "tipo",
                "string",
                description=(
                    "Etnia. Valores permitidos: " + ", ".join(CATALOGOS_CARACTERIZACION["etnia"]) + "."
                ),
                allowed_values=CATALOGOS_CARACTERIZACION["etnia"],
            ),
            DatasetField(
                "sexo",
                "string",
                allowed_values=SEXOS,
                description="Sexo del alumnado. Valores permitidos: Hombre o Mujer.",
            ),
            DatasetField("cantidad", "int", description="Numero de alumnos de ese tipo."),
        ),
    ),
}


def get_dataset_definition(dataset_type: str) -> DatasetDefinition:
    try:
        return DATASET_DEFINITIONS[dataset_type]  # type: ignore[index]
    except KeyError as exc:
        raise ValueError(f"Dataset type desconocido: {dataset_type}") from exc

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


FieldKind = Literal["string", "int", "float"]
DatasetType = Literal[
    "matricula",
    "evaluacion_academica",
    "titulacion",
    "evaluacion_docente",
    "caracterizacion",
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


# ---------------------------------------------------------------------------
# Catalogos estandar sugeridos para la caracterizacion del alumnado.
# Son sugerencias: el usuario puede elegir de la lista o capturar texto libre.
# ---------------------------------------------------------------------------

CATALOGOS_CARACTERIZACION: dict[str, tuple[str, ...]] = {
    "beca": (
        "Manutencion",
        "Excelencia",
        "Apoyo Indigena",
        "Deportiva",
        "Movilidad",
        "Titulacion",
        "Apoyo Discapacidad",
        "Otra",
    ),
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
        description="Inscripcion total y nuevo ingreso por programa, cuatrimestre y ciclo.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("cuatrimestre", "int"),
            DatasetField("programa_educativo", "string"),
            DatasetField("total", "int"),
            DatasetField("nuevo_ingreso", "int"),
            DatasetField("bajas_reprobacion", "int"),
            DatasetField("bajas_desercion", "int"),
            DatasetField("hombres", "int"),
            DatasetField("mujeres", "int"),
            DatasetField("poblacion_edad_escolar", "int", required=False),
            DatasetField("egresados_nms", "int", required=False),
        ),
    ),
    "evaluacion_academica": DatasetDefinition(
        key="evaluacion_academica",
        label="Evaluacion Academica",
        description="Promedio general del programa educativo y numero de PE evaluados.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("cuatrimestre", "int"),
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
            DatasetField("matricula_generacional", "int"),
            DatasetField("concluyeron_estudios", "int"),
            DatasetField("egresados", "int"),
            DatasetField("titulados", "int"),
            DatasetField("ingresados_ns", "int", required=False),
        ),
    ),
    "evaluacion_docente": DatasetDefinition(
        key="evaluacion_docente",
        label="Evaluacion Docente",
        description="Puntajes de evaluacion por docente. Un registro por evaluador por docente.",
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("docente_id", "string"),
            DatasetField("docente_nombre", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField(
                "evaluador_tipo",
                "string",
                allowed_values=("alumno", "directivo"),
                description="Valores permitidos: alumno o directivo.",
            ),
            DatasetField("puntaje", "float"),
        ),
    ),
    "caracterizacion": DatasetDefinition(
        key="caracterizacion",
        label="Caracterizacion (Becas / Discapacidad / Etnia)",
        description=(
            "Desglose del alumnado por tipo de beca, discapacidad o etnia. "
            "Un registro por cada tipo, con la cantidad de alumnos por programa y ciclo."
        ),
        fields=(
            DatasetField("ciclo_escolar", "string"),
            DatasetField("programa_educativo", "string"),
            DatasetField(
                "categoria",
                "string",
                allowed_values=("beca", "discapacidad", "etnia"),
                description="Valores permitidos: beca, discapacidad o etnia.",
            ),
            DatasetField(
                "tipo",
                "string",
                description="Tipo especifico (ej. Manutencion, Motriz, Nahuatl). Catalogo sugerido; admite texto libre.",
                suggested_values=tuple(
                    sorted({v for vals in CATALOGOS_CARACTERIZACION.values() for v in vals})
                ),
            ),
            DatasetField("cantidad", "int", description="Numero de alumnos de ese tipo."),
        ),
        catalogos=CATALOGOS_CARACTERIZACION,
    ),
}


def get_dataset_definition(dataset_type: str) -> DatasetDefinition:
    try:
        return DATASET_DEFINITIONS[dataset_type]  # type: ignore[index]
    except KeyError as exc:
        raise ValueError(f"Dataset type desconocido: {dataset_type}") from exc

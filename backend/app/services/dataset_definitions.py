from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


FieldKind = Literal["string", "int", "float"]
DatasetType = Literal["matricula", "evaluacion_academica", "titulacion", "evaluacion_docente"]


@dataclass(frozen=True)
class DatasetField:
    name: str
    kind: FieldKind
    required: bool = True
    description: str | None = None
    allowed_values: tuple[str, ...] | None = None


@dataclass(frozen=True)
class DatasetDefinition:
    key: DatasetType
    label: str
    description: str
    fields: tuple[DatasetField, ...]

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
}


def get_dataset_definition(dataset_type: str) -> DatasetDefinition:
    try:
        return DATASET_DEFINITIONS[dataset_type]  # type: ignore[index]
    except KeyError as exc:
        raise ValueError(f"Dataset type desconocido: {dataset_type}") from exc

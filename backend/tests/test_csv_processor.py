from pathlib import Path

from app.services.csv_processor import parse_and_validate


def test_parse_and_validate_rejects_invalid_rows_and_keeps_valid_rows(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,cuatrimestre,programa_educativo,total,nuevo_ingreso,bajas_reprobacion,bajas_desercion,hombres,mujeres,poblacion_edad_escolar,egresados_nms",
            "2025-2026,1,Ingenieria,100,20,5,3,55,45,200,80",
            "2025-2026,dos,Administracion,90,10,2,1,40,50,180,70",
        ]
    )
    file_path = tmp_path / "matricula.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "matricula")

    assert len(df) == 1
    assert df.iloc[0].to_dict()["programa_educativo"] == "Ingenieria"
    assert errors == [
        {
            "row": 3,
            "column": "cuatrimestre",
            "value": "dos",
            "error": "no es entero",
        }
    ]


def test_parse_and_validate_normalizes_allowed_values(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,docente_id,docente_nombre,programa_educativo,evaluador_tipo,puntaje",
            "2025-2026,DOC-01,Ana Perez,Ingenieria,ALUMNO,95.5",
            "2025-2026,DOC-02,Luis Perez,Ingenieria,Coordinador,90",
        ]
    )
    file_path = tmp_path / "docentes.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "evaluacion_docente")

    assert len(df) == 1
    assert df.iloc[0].to_dict()["evaluador_tipo"] == "alumno"
    assert errors == [
        {
            "row": 3,
            "column": "evaluador_tipo",
            "value": "Coordinador",
            "error": "debe ser uno de: alumno, directivo",
        }
    ]

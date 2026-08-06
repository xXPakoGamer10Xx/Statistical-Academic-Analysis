from pathlib import Path

from app.services.csv_processor import parse_and_validate, rows_from_dataframe


def test_parse_and_validate_rejects_invalid_rows_and_keeps_valid_rows(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,cuatrimestre,programa_educativo,bajas_reprobacion,bajas_desercion,hombres,mujeres,otros_ingresos",
            "2025-2026,1,Ingenieria,5,3,55,45,200",
            "2025-2026,dos,Administracion,2,1,40,50,180",
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


def test_parse_and_validate_rejects_negative_numbers(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,cuatrimestre,programa_educativo,bajas_reprobacion,bajas_desercion,hombres,mujeres,otros_ingresos",
            "2025-2026,1,Ingenieria,-100,3,55,45,200",
        ]
    )
    file_path = tmp_path / "matricula_negativo.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "matricula")

    assert len(df) == 0
    assert errors == [
        {
            "row": 2,
            "column": "bajas_reprobacion",
            "value": "-100",
            "error": "no puede ser negativo",
        }
    ]


def test_parse_and_validate_nuevo_ingreso_dataset(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,cuatrimestre,programa_educativo,ingreso_examen,ingreso_pase_directo,ingreso_renoes,ingreso_uaem_gem",
            "2025-2026,1,Ingenieria,15,4,1,2",
            "2025-2026,2,Administracion,-8,2,0,1",
        ]
    )
    file_path = tmp_path / "nuevo_ingreso.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "nuevo_ingreso")

    assert len(df) == 1
    assert df.iloc[0].to_dict()["programa_educativo"] == "Ingenieria"
    assert errors == [
        {
            "row": 3,
            "column": "ingreso_examen",
            "value": "-8",
            "error": "no puede ser negativo",
        }
    ]


def test_rows_from_dataframe_converts_nan_optional_ints_to_none(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,cuatrimestre,programa_educativo,bajas_reprobacion,bajas_desercion,hombres,mujeres,otros_ingresos",
            "2025-2026,1,Ingenieria,5,3,55,45,300",
            "2025-2026,2,Administracion,2,1,40,50,",
        ]
    )
    file_path = tmp_path / "matricula_optional.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "matricula")
    rows = rows_from_dataframe(df)

    assert not errors
    assert len(rows) == 2
    assert rows[0]["otros_ingresos"] == 300
    assert rows[1]["otros_ingresos"] is None


def test_parse_and_validate_normalizes_allowed_values(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,puesto,docente_nombre,programa_educativo,evaluador_tipo,puntaje",
            "2025-2026,p.a.,Ana Perez,Ingenieria,ALUMNO,9.5",
            "2025-2026,P.T.C.,Luis Perez,Ingenieria,Coordinador,9",
        ]
    )
    file_path = tmp_path / "docentes.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "evaluacion_docente")

    assert len(df) == 1
    assert df.iloc[0].to_dict()["evaluador_tipo"] == "alumno"
    # "p.a." (minusculas, tal como vendria de un CSV) debe normalizarse a la forma
    # canonica "P.A." definida en allowed_values, no forzarse a minusculas.
    assert df.iloc[0].to_dict()["puesto"] == "P.A."
    assert errors == [
        {
            "row": 3,
            "column": "evaluador_tipo",
            "value": "Coordinador",
            "error": "debe ser uno de: alumno, directivo",
        }
    ]


def test_parse_and_validate_rejects_puntaje_over_max(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,puesto,docente_nombre,programa_educativo,evaluador_tipo,puntaje",
            "2025-2026,P.A.,Ana Perez,Ingenieria,alumno,10.5",
        ]
    )
    file_path = tmp_path / "docentes_max.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "evaluacion_docente")

    assert len(df) == 0
    assert errors == [
        {
            "row": 2,
            "column": "puntaje",
            "value": "10.5",
            "error": "no puede ser mayor a 10",
        }
    ]


def test_parse_and_validate_rejects_puntaje_under_min(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,puesto,docente_nombre,programa_educativo,evaluador_tipo,puntaje",
            "2025-2026,P.A.,Ana Perez,Ingenieria,alumno,0",
        ]
    )
    file_path = tmp_path / "docentes_min.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "evaluacion_docente")

    assert len(df) == 0
    assert errors == [
        {
            "row": 2,
            "column": "puntaje",
            "value": "0",
            "error": "no puede ser menor a 1",
        }
    ]


def test_parse_and_validate_rejects_infinite_and_nan_floats(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,puesto,docente_nombre,programa_educativo,evaluador_tipo,puntaje",
            "2025-2026,P.A.,Ana Perez,Ingenieria,alumno,inf",
        ]
    )
    file_path = tmp_path / "docentes_inf.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "evaluacion_docente")

    assert len(df) == 0
    assert errors == [
        {
            "row": 2,
            "column": "puntaje",
            "value": "inf",
            "error": "no es un número válido",
        }
    ]

from pathlib import Path

from app.services.csv_processor import parse_and_validate


def test_parse_and_validate_becas_dataset(tmp_path: Path) -> None:
    csv_content = "\n".join(
        [
            "ciclo_escolar,programa_educativo,tipo,cantidad",
            "2024-2025,Ingenieria,Manutencion,25",
            "2024-2025,Ingenieria,Excelencia,10",
            "2024-2025,Administracion,,5",
        ]
    )
    file_path = tmp_path / "becas.csv"
    file_path.write_text(csv_content, encoding="utf-8")

    df, errors = parse_and_validate(str(file_path), "becas")

    assert len(df) == 2
    assert df.iloc[0].to_dict()["tipo"] == "Manutencion"
    assert errors == [
        {
            "row": 4,
            "column": "tipo",
            "value": "",
            "error": "valor requerido",
        }
    ]


def test_csv_becas_suggested_dataset_type(tmp_path: Path) -> None:
    from app.services.excel_analyzer import analyze_csv_file

    csv_path = tmp_path / "becas.csv"
    csv_path.write_text(
        "ciclo_escolar,programa_educativo,tipo,cantidad\n"
        "2024-2025,Mecatronica,Manutencion,10\n",
        encoding="utf-8",
    )

    sheet = analyze_csv_file(str(csv_path)).sheets[0]

    assert sheet.suggested_dataset_type == "becas"
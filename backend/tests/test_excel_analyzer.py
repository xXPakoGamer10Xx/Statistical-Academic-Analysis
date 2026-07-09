import openpyxl

from app.services.excel_analyzer import analyze_csv_file, analyze_excel_file


def test_csv_discapacidad_maps_programa_educativo(tmp_path):
    csv_path = tmp_path / "discapacidad.csv"
    csv_path.write_text(
        "ciclo_escolar,programa_educativo,tipo,cantidad\n"
        "2024-2025,Mecatronica,Motriz,10\n",
        encoding="utf-8",
    )

    sheet = analyze_csv_file(str(csv_path)).sheets[0]
    mapping = {item.excel_column: item.system_field for item in sheet.column_mapping}

    # becas/discapacidad/etnia comparten exactamente las mismas columnas requeridas
    # (ciclo_escolar, programa_educativo, tipo, cantidad), asi que el detector automatico
    # no puede distinguirlas solo por nombre de columna -- cualquiera de las tres es un
    # acierto valido; el usuario confirma el tipo antes de subir.
    assert sheet.suggested_dataset_type in {"becas", "discapacidad", "etnia"}
    assert mapping["programa_educativo"] == "programa_educativo"
    assert sheet.sample_rows[0][sheet.header_column_indices[1]] == "Mecatronica"


def test_excel_skips_empty_header_without_shifting_values(tmp_path):
    xlsx_path = tmp_path / "shifted.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["ciclo_escolar", "", "programa_educativo", "categoria", "tipo", "cantidad"])
    ws.append(["2024-2025", False, "Mecatronica", "discapacidad", "Motriz", 10])
    wb.save(xlsx_path)

    sheet = analyze_excel_file(str(xlsx_path)).sheets[0]
    prog_header_idx = sheet.detected_headers.index("programa_educativo")
    prog_col_idx = sheet.header_column_indices[prog_header_idx]

    assert prog_col_idx == 2
    assert sheet.sample_rows[0][prog_col_idx] == "Mecatronica"
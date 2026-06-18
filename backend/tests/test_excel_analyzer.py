import openpyxl

from app.services.excel_analyzer import analyze_csv_file, analyze_excel_file


def test_csv_caracterizacion_maps_programa_educativo(tmp_path):
    csv_path = tmp_path / "caracterizacion.csv"
    csv_path.write_text(
        "ciclo_escolar,programa_educativo,categoria,tipo,cantidad\n"
        "2024-2025,Mecatronica,beca,Titulacion,10\n",
        encoding="utf-8",
    )

    sheet = analyze_csv_file(str(csv_path)).sheets[0]
    mapping = {item.excel_column: item.system_field for item in sheet.column_mapping}

    assert sheet.suggested_dataset_type == "caracterizacion"
    assert mapping["programa_educativo"] == "programa_educativo"
    assert sheet.sample_rows[0][sheet.header_column_indices[1]] == "Mecatronica"


def test_excel_skips_empty_header_without_shifting_values(tmp_path):
    xlsx_path = tmp_path / "shifted.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["ciclo_escolar", "", "programa_educativo", "categoria", "tipo", "cantidad"])
    ws.append(["2024-2025", False, "Mecatronica", "beca", "Titulacion", 10])
    wb.save(xlsx_path)

    sheet = analyze_excel_file(str(xlsx_path)).sheets[0]
    prog_header_idx = sheet.detected_headers.index("programa_educativo")
    prog_col_idx = sheet.header_column_indices[prog_header_idx]

    assert prog_col_idx == 2
    assert sheet.sample_rows[0][prog_col_idx] == "Mecatronica"
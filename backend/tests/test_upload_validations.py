from app.services.upload_validations import check_ciclo_catalog, check_madres_solteras


def test_check_madres_solteras_rejects_sexo_hombre() -> None:
    rows = [
        {
            "subsistema_id": 1,
            "ciclo_escolar": "2024-2025",
            "programa_educativo": "Ingenieria",
            "tipo": "Madres solteras",
            "sexo": "Hombre",
            "cantidad": 3,
        }
    ]

    rows_ok, errors = check_madres_solteras(rows, {})

    assert rows_ok == []
    assert errors == [
        {
            "row": 1,
            "column": "sexo",
            "value": "Hombre",
            "error": "'Madres solteras' solo aplica a sexo Mujer.",
        }
    ]


def test_check_madres_solteras_rejects_cantidad_exceeding_mujeres() -> None:
    rows = [
        {
            "subsistema_id": 1,
            "ciclo_escolar": "2024-2025",
            "programa_educativo": "Ingenieria",
            "tipo": "Madres solteras",
            "sexo": "Mujer",
            "cantidad": 15,
        }
    ]
    mujeres_by_key = {(1, "2024-2025", "Ingenieria"): 10}

    rows_ok, errors = check_madres_solteras(rows, mujeres_by_key)

    assert rows_ok == []
    assert len(errors) == 1
    assert errors[0]["column"] == "cantidad"


def test_check_madres_solteras_accepts_valid_row() -> None:
    rows = [
        {
            "subsistema_id": 1,
            "ciclo_escolar": "2024-2025",
            "programa_educativo": "Ingenieria",
            "tipo": "Madres solteras",
            "sexo": "Mujer",
            "cantidad": 5,
        }
    ]
    mujeres_by_key = {(1, "2024-2025", "Ingenieria"): 10}

    rows_ok, errors = check_madres_solteras(rows, mujeres_by_key)

    assert rows_ok == rows
    assert errors == []


def test_check_ciclo_catalog_filters_invalid_ciclo() -> None:
    rows = [
        {"ciclo_escolar": "2024-2025", "tipo": "Manutencion"},
        {"ciclo_escolar": "1999-2000", "tipo": "Excelencia"},
    ]

    rows_ok, errors = check_ciclo_catalog(rows, "becas", {"2024-2025"})

    assert rows_ok == [rows[0]]
    assert errors == [
        {
            "row": 2,
            "column": "ciclo_escolar",
            "value": "1999-2000",
            "error": "no existe en el catálogo de ciclos generacionales o está deshabilitado",
        }
    ]

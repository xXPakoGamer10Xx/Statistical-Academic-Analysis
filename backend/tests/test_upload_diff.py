from app.services.upload_diff import compare_upload_with_baseline


def _matricula_row(**overrides) -> dict:
    base = {
        "subsistema_id": 1,
        "ciclo_escolar": "2024-2025",
        "cuatrimestre": 1,
        "programa_educativo": "Ingenieria",
        "bajas_reprobacion": 5,
        "bajas_desercion": 3,
        "hombres": 55,
        "mujeres": 45,
        "poblacion_edad_escolar": 200,
        "egresados_nms": 80,
    }
    base.update(overrides)
    return base


def test_compare_detects_added_modified_removed_and_unchanged() -> None:
    baseline = [
        _matricula_row(programa_educativo="Ingenieria", bajas_reprobacion=100),
        _matricula_row(programa_educativo="Administracion", bajas_reprobacion=90),
    ]
    new_rows = [
        _matricula_row(programa_educativo="Ingenieria", bajas_reprobacion=110),
        _matricula_row(programa_educativo="Contabilidad", bajas_reprobacion=70),
    ]

    result = compare_upload_with_baseline(new_rows, baseline, "matricula", detail_limit=10)

    assert result["summary"] == {
        "added": 1,
        "removed": 1,
        "modified": 1,
        "unchanged": 0,
    }
    assert result["added"][0]["key"]["programa_educativo"] == "Contabilidad"
    assert result["removed"][0]["key"]["programa_educativo"] == "Administracion"
    assert result["modified"][0]["changes"][0]["field"] == "bajas_reprobacion"
    assert result["modified"][0]["changes"][0]["old_value"] == "100"
    assert result["modified"][0]["changes"][0]["new_value"] == "110"


def test_compare_normalizes_numeric_formats() -> None:
    baseline = [_matricula_row(bajas_reprobacion=100)]
    new_rows = [_matricula_row(bajas_reprobacion="100")]

    result = compare_upload_with_baseline(new_rows, baseline, "matricula")

    assert result["summary"]["modified"] == 0
    assert result["summary"]["unchanged"] == 1


def test_compare_truncates_detail_lists() -> None:
    baseline = [_matricula_row(programa_educativo=f"Programa {i}", bajas_reprobacion=i) for i in range(60)]
    new_rows = [_matricula_row(programa_educativo=f"Nuevo {i}", bajas_reprobacion=i) for i in range(60)]

    result = compare_upload_with_baseline(new_rows, baseline, "matricula", detail_limit=10)

    assert result["summary"]["added"] == 60
    assert result["summary"]["removed"] == 60
    assert len(result["added"]) == 10
    assert len(result["removed"]) == 10
    assert result["truncated"] is True


def test_compare_without_baseline_marks_all_as_added() -> None:
    new_rows = [_matricula_row()]

    result = compare_upload_with_baseline(new_rows, [], "matricula")

    assert result["summary"] == {
        "added": 1,
        "removed": 0,
        "modified": 0,
        "unchanged": 0,
    }
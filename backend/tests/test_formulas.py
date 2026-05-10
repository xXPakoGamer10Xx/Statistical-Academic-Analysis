from app.services.formulas import calculate_matricula_actual, calculate_percentage


def test_calculate_matricula_actual_matches_required_formula() -> None:
    assert calculate_matricula_actual(100, 5, 3, 20) == 112


def test_calculate_percentage_handles_normal_and_zero_denominator() -> None:
    assert calculate_percentage(25, 100) == 25.0
    assert calculate_percentage(12, 0) == 0.0

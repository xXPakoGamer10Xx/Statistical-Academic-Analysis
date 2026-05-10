def calculate_matricula_actual(
    total: int,
    bajas_reprobacion: int,
    bajas_desercion: int,
    nuevo_ingreso: int,
) -> int:
    return total - bajas_reprobacion - bajas_desercion + nuevo_ingreso


def calculate_percentage(numerator: float | int, denominator: float | int) -> float:
    if not denominator:
        return 0.0
    return float(numerator) * 100 / float(denominator)

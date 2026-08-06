def calculate_matricula_actual(
    total: int,
    bajas_reprobacion: int,
    bajas_desercion: int,
    nuevo_ingreso: int,
    otros_ingresos: int = 0,
) -> int:
    return total - bajas_reprobacion - bajas_desercion + nuevo_ingreso + otros_ingresos


def calculate_percentage(numerator: float | int | None, denominator: float | int | None) -> float:
    if not denominator:
        return 0.0
    return float(numerator or 0) * 100 / float(denominator)

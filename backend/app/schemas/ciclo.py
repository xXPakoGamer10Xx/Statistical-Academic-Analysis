from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

TipoCiclo = Literal["ciclo", "generacion"]


class CicloCreate(BaseModel):
    valor: str
    tipo: TipoCiclo

    @field_validator("valor")
    @classmethod
    def _valida_formato(cls, v: str) -> str:
        partes = v.split("-")
        if len(partes) != 2 or not all(p.isdigit() and len(p) == 4 for p in partes):
            raise ValueError("El valor debe tener el formato AAAA-AAAA (ej. 2024-2025)")
        return v

    @model_validator(mode="after")
    def _valida_rango_segun_tipo(self) -> "CicloCreate":
        año1, año2 = (int(p) for p in self.valor.split("-"))
        if self.tipo == "ciclo" and año2 != año1 + 1:
            raise ValueError("Un 'ciclo' debe cubrir un único año académico (ej. 2024-2025)")
        if self.tipo == "generacion" and año2 <= año1:
            raise ValueError("Una 'generacion' debe cubrir un rango de años válido (ej. 2020-2023)")
        return self


class CicloUpdate(BaseModel):
    activo: bool


class CicloOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    valor: str
    tipo: TipoCiclo
    activo: bool
    created_at: datetime
    # True si ya existe matrícula capturada para este ciclo. Los ciclos "ciclo" se dan de
    # alta con antelación para planeación y suelen no tener datos aún; el frontend usa esto
    # para no preseleccionar como "más reciente" un ciclo futuro todavía vacío.
    con_datos: bool = True

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

NivelCarrera = Literal["tsu", "profesional"]


class CarreraCreate(BaseModel):
    subsistema_id: int
    nombre: str
    nivel: NivelCarrera
    carrera_par_id: int | None = None


class CarreraUpdate(BaseModel):
    activo: bool | None = None
    carrera_par_id: int | None = None


class CarreraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subsistema_id: int
    nombre: str
    nivel: NivelCarrera
    carrera_par_id: int | None
    activo: bool
    created_at: datetime

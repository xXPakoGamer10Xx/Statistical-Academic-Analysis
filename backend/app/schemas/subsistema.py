from pydantic import BaseModel, ConfigDict


class SubsistemaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    codigo: str
    descripcion: str | None = None

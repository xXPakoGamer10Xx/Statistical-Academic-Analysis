from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CicloGeneracional(Base):
    """Catalogo administrable de ciclos escolares y generaciones.

    ``tipo`` distingue dos formatos incompatibles que comparten catalogo/CRUD:
    - "ciclo": ano academico unico (ej. "2024-2025", ano2 = ano1 + 1).
    - "generacion": cohorte plurianual usada en Titulacion/Eficiencia Terminal
      (ej. "2020-2023", ano2 > ano1).
    """

    __tablename__ = "ciclos_generacionales"
    __table_args__ = (
        UniqueConstraint("valor", "tipo", name="uq_ciclo_generacional_valor_tipo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    valor: Mapped[str] = mapped_column(String(9), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

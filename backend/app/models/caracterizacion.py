from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Caracterizacion(Base):
    """Desglose poblacional del alumnado por categoria (discapacidad, etnia).

    Guarda CUANTOS alumnos hay de cada tipo dentro de una categoria, por programa
    y ciclo escolar. Las becas se almacenan en la tabla ``becas``.
    """

    __tablename__ = "caracterizacion"
    __table_args__ = (
        UniqueConstraint(
            "subsistema_id",
            "ciclo_escolar",
            "programa_educativo",
            "categoria",
            "tipo",
            "sexo",
            name="uq_caracterizacion",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ciclo_escolar: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    programa_educativo: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    # Categoria: discapacidad | etnia
    categoria: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # Tipo especifico dentro de la categoria (ej. "Manutencion", "Motriz", "Nahuatl")
    tipo: Mapped[str] = mapped_column(String(100), nullable=False)
    # Sexo del alumnado (Hombre/Mujer). Nullable: filas historicas no lo tienen.
    sexo: Mapped[str | None] = mapped_column(String(10), nullable=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

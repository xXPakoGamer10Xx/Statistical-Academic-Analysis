from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProgramaEducativo(Base):
    """Catalogo administrable de carreras (programa_educativo) por subsistema.

    ``nivel`` distingue TSU (Tecnico Superior Universitario, 2 anios) de un programa
    "profesional" (Ingenieria/Licenciatura, continuacion tipica del TSU). ``carrera_par_id``
    enlaza cada TSU con su Ingenieria/Licenciatura relacionada (y viceversa) cuando aplica;
    se guarda en ambos lados al crearse el par.
    """

    __tablename__ = "programas_educativos"
    __table_args__ = (
        UniqueConstraint("subsistema_id", "nombre", name="uq_programa_educativo_subsistema_nombre"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    nivel: Mapped[str] = mapped_column(String(20), nullable=False)
    carrera_par_id: Mapped[int | None] = mapped_column(
        ForeignKey("programas_educativos.id", ondelete="SET NULL"), nullable=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EvaluacionAcademica(Base):
    __tablename__ = "evaluacion_academica"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ciclo_escolar: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    cuatrimestre: Mapped[int] = mapped_column(Integer, nullable=False)
    programa_educativo: Mapped[str] = mapped_column(String(150), nullable=False)
    promedio_pe: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    num_pe: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class EvaluacionDocente(Base):
    __tablename__ = "evaluacion_docente"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ciclo_escolar: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    docente_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    docente_nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    programa_educativo: Mapped[str] = mapped_column(String(150), nullable=False)
    evaluador_tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    puntaje: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

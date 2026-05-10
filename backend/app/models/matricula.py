from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Matricula(Base):
    __tablename__ = "matricula"
    __table_args__ = (
        UniqueConstraint(
            "subsistema_id",
            "ciclo_escolar",
            "cuatrimestre",
            "programa_educativo",
            name="uq_matricula_periodo",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ciclo_escolar: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    cuatrimestre: Mapped[int] = mapped_column(Integer, nullable=False)
    programa_educativo: Mapped[str] = mapped_column(String(150), nullable=False, index=True)

    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nuevo_ingreso: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bajas_reprobacion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bajas_desercion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hombres: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mujeres: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    poblacion_edad_escolar: Mapped[int | None] = mapped_column(Integer, nullable=True)
    egresados_nms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

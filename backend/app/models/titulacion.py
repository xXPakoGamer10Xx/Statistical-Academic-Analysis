from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Titulacion(Base):
    __tablename__ = "titulacion"
    __table_args__ = (
        UniqueConstraint(
            "subsistema_id", "generacion", "programa_educativo", name="uq_titulacion_generacion"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    generacion: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    programa_educativo: Mapped[str] = mapped_column(String(150), nullable=False)

    matricula_generacional: Mapped[int] = mapped_column(Integer, nullable=False)
    concluyeron_estudios: Mapped[int] = mapped_column(Integer, nullable=False)
    egresados: Mapped[int] = mapped_column(Integer, nullable=False)
    titulados: Mapped[int] = mapped_column(Integer, nullable=False)
    ingresados_ns: Mapped[int | None] = mapped_column(Integer, nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

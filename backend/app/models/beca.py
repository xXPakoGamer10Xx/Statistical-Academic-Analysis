from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Beca(Base):
    """Desglose del alumnado becado por tipo de beca, programa y ciclo escolar."""

    __tablename__ = "becas"
    __table_args__ = (
        UniqueConstraint(
            "subsistema_id",
            "ciclo_escolar",
            "programa_educativo",
            "tipo",
            name="uq_beca",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subsistema_id: Mapped[int] = mapped_column(
        ForeignKey("subsistemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ciclo_escolar: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    programa_educativo: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(100), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
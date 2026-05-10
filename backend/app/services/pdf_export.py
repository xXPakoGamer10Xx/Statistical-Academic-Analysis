from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.ext.asyncio import AsyncSession
from weasyprint import HTML

from app.services.indicadores import (
    calcular_eficiencia,
    calcular_evaluacion_docente,
    calcular_matricula,
    calcular_rendimiento,
)

TEMPLATES_DIR = Path(__file__).parent / "templates"
TEMPLATES_DIR.mkdir(exist_ok=True)

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


async def generar_reporte_pdf(
    db: AsyncSession,
    seccion: str,
    subsistema_id: int | None,
    ciclo_escolar: str | None,
    usuario: str,
) -> bytes:
    contexto: dict[str, object] = {
        "fecha": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "usuario": usuario,
        "seccion": seccion,
        "ciclo_escolar": ciclo_escolar or "Todos",
    }

    if seccion in {"matricula", "completo"}:
        contexto["matricula"] = await calcular_matricula(
            db, subsistema_id=subsistema_id, ciclo_escolar=ciclo_escolar
        )
    if seccion in {"rendimiento", "completo"}:
        contexto["rendimiento"] = await calcular_rendimiento(
            db, subsistema_id=subsistema_id, ciclo_escolar=ciclo_escolar
        )
    if seccion in {"eficiencia", "completo"}:
        contexto["eficiencia"] = await calcular_eficiencia(db, subsistema_id=subsistema_id)
    if seccion in {"docentes", "completo"}:
        contexto["docentes"] = await calcular_evaluacion_docente(
            db, subsistema_id=subsistema_id, ciclo_escolar=ciclo_escolar
        )

    template = _env.get_template("reporte.html")
    html_content = template.render(**contexto)
    return HTML(string=html_content).write_pdf() or b""

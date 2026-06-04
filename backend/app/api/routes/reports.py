from datetime import datetime

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.api.deps import DbDep, SchoolAdminUser
from app.services.pdf_export import generar_reporte_pdf

router = APIRouter()


@router.get("/pdf")
async def export_pdf(
    user: SchoolAdminUser,
    db: DbDep,
    seccion: str = Query("matricula", regex="^(matricula|rendimiento|eficiencia|docentes|completo)$"),
    subsistema_id: int | None = Query(None),
    ciclo_escolar: str | None = Query(None),
) -> Response:
    sid = subsistema_id if user.role == "admin_general" else user.subsistema_id
    pdf_bytes = await generar_reporte_pdf(
        db,
        seccion=seccion,
        subsistema_id=sid,
        ciclo_escolar=ciclo_escolar,
        usuario=user.full_name,
    )
    seccion_cap = seccion.capitalize()
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"Reporte_UPTEX_{seccion_cap}_{stamp}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

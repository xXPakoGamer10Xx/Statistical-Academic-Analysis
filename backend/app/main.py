from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import (
    audit,
    auth,
    docentes,
    eficiencia,
    health,
    matricula,
    rendimiento,
    reports,
    subsistemas,
    templates,
    uploads,
    users,
)
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, exc):  # type: ignore[no-untyped-def]
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor", "error": str(exc) if settings.DEBUG else None},
    )


prefix = settings.API_V1_PREFIX
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{prefix}/users", tags=["users"])
app.include_router(subsistemas.router, prefix=f"{prefix}/subsistemas", tags=["subsistemas"])
app.include_router(uploads.router, prefix=f"{prefix}/uploads", tags=["uploads"])
app.include_router(matricula.router, prefix=f"{prefix}/matricula", tags=["matricula"])
app.include_router(rendimiento.router, prefix=f"{prefix}/rendimiento", tags=["rendimiento"])
app.include_router(eficiencia.router, prefix=f"{prefix}/eficiencia", tags=["eficiencia"])
app.include_router(docentes.router, prefix=f"{prefix}/docentes", tags=["docentes"])
app.include_router(reports.router, prefix=f"{prefix}/reports", tags=["reports"])
app.include_router(templates.router, prefix=f"{prefix}/templates", tags=["templates"])
app.include_router(audit.router, prefix=f"{prefix}/audit-logs", tags=["audit"])

from app.models.audit_log import AuditLog
from app.models.evaluacion import EvaluacionAcademica, EvaluacionDocente
from app.models.matricula import Matricula
from app.models.subsistema import Subsistema
from app.models.titulacion import Titulacion
from app.models.upload_job import UploadJob
from app.models.user import User

__all__ = [
    "AuditLog",
    "EvaluacionAcademica",
    "EvaluacionDocente",
    "Matricula",
    "Subsistema",
    "Titulacion",
    "UploadJob",
    "User",
]

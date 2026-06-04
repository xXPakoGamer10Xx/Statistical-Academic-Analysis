from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import DbDep, GeneralAdminUser
from app.models.audit_log import AuditLog
from app.models.user import User
from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str | None
    actor_name: str | None = None
    action: str
    target_type: str | None
    target_id: str | None
    details: dict | None
    created_at: datetime


router = APIRouter()


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(
    _admin: GeneralAdminUser,
    db: DbDep,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None),
) -> list[AuditLogOut]:
    stmt = select(AuditLog, User.full_name).outerjoin(
        User, AuditLog.user_id == User.id
    )
    if action:
        stmt = stmt.where(AuditLog.action == action)
    stmt = stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(stmt)
    rows = result.all()

    return [
        AuditLogOut(
            id=log.id,
            user_id=str(log.user_id) if log.user_id else None,
            actor_name=full_name,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log, full_name in rows
    ]

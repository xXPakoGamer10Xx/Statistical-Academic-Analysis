from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep
from app.models.subsistema import Subsistema
from app.schemas.subsistema import SubsistemaOut

router = APIRouter()


@router.get("", response_model=list[SubsistemaOut])
async def list_subsistemas(_user: CurrentUser, db: DbDep) -> list[Subsistema]:
    result = await db.execute(select(Subsistema).order_by(Subsistema.id))
    return list(result.scalars().all())

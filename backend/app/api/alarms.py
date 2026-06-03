"""Alarm management API — list, acknowledge, resolve."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.alarm import AlarmLog
from app.models.device import Device
from pydantic import BaseModel

router = APIRouter(prefix="/api/alarms", tags=["alarms"])


# ── Schemas ──

class AlarmOut(BaseModel):
    id: str
    device_id: str
    device_code: str
    device_name: str
    alarm_type: str
    alarm_code: str | None = None
    message: str
    acknowledged: bool
    ack_by: str | None = None
    ack_at: str | None = None
    resolved_at: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


class AlarmListOut(BaseModel):
    total: int
    items: list[AlarmOut]


class AcknowledgeBody(BaseModel):
    ack_by: str = "operator"


# ── List alarms ──

@router.get("", response_model=AlarmListOut)
async def list_alarms(
    device_id: str | None = Query(None),
    alarm_type: str | None = Query(None),
    acknowledged: bool | None = Query(None),
    resolved: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Cross-device alarm list with filters."""
    base_q = select(AlarmLog)
    count_q = select(func.count(AlarmLog.id))

    if device_id:
        base_q = base_q.where(AlarmLog.device_id == device_id)
        count_q = count_q.where(AlarmLog.device_id == device_id)
    if alarm_type:
        base_q = base_q.where(AlarmLog.alarm_type == alarm_type)
        count_q = count_q.where(AlarmLog.alarm_type == alarm_type)
    if acknowledged is not None:
        base_q = base_q.where(AlarmLog.acknowledged == acknowledged)
        count_q = count_q.where(AlarmLog.acknowledged == acknowledged)
    if resolved is not None:
        if resolved:
            base_q = base_q.where(AlarmLog.resolved_at != None)
            count_q = count_q.where(AlarmLog.resolved_at != None)
        else:
            base_q = base_q.where(AlarmLog.resolved_at == None)
            count_q = count_q.where(AlarmLog.resolved_at == None)

    total = (await db.execute(count_q)).scalar() or 0

    rows = (await db.execute(
        base_q.order_by(AlarmLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    # Fetch device info for each alarm
    dev_ids = list({r.device_id for r in rows})
    dev_map: dict[str, Device] = {}
    if dev_ids:
        devs = (await db.execute(select(Device).where(Device.id.in_(dev_ids)))).scalars().all()
        dev_map = {d.id: d for d in devs}

    items = []
    for r in rows:
        dev = dev_map.get(r.device_id)
        items.append(AlarmOut(
            id=r.id,
            device_id=r.device_id,
            device_code=dev.device_code if dev else "?",
            device_name=dev.name if dev else "?",
            alarm_type=r.alarm_type,
            alarm_code=r.alarm_code,
            message=r.message,
            acknowledged=r.acknowledged,
            ack_by=r.ack_by,
            ack_at=r.ack_at.isoformat() if r.ack_at else None,
            resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
            created_at=r.created_at.isoformat() if r.created_at else None,
        ))
    return AlarmListOut(total=total, items=items)


# ── Acknowledge ──

@router.put("/{alarm_id}/acknowledge", response_model=AlarmOut)
async def acknowledge_alarm(
    alarm_id: str,
    body: AcknowledgeBody,
    db: AsyncSession = Depends(get_db),
):
    r = (await db.execute(select(AlarmLog).where(AlarmLog.id == alarm_id))).scalar()
    if not r:
        raise HTTPException(status_code=404, detail="Alarm not found")
    r.acknowledged = True
    r.ack_by = body.ack_by
    r.ack_at = datetime.utcnow()
    await db.commit()
    await db.refresh(r)
    dev = (await db.execute(select(Device).where(Device.id == r.device_id))).scalar()
    return AlarmOut(
        id=r.id, device_id=r.device_id,
        device_code=dev.device_code if dev else "?", device_name=dev.name if dev else "?",
        alarm_type=r.alarm_type, alarm_code=r.alarm_code, message=r.message,
        acknowledged=r.acknowledged, ack_by=r.ack_by,
        ack_at=r.ack_at.isoformat() if r.ack_at else None,
        resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


# ── Resolve ──

@router.put("/{alarm_id}/resolve", response_model=AlarmOut)
async def resolve_alarm(
    alarm_id: str,
    db: AsyncSession = Depends(get_db),
):
    r = (await db.execute(select(AlarmLog).where(AlarmLog.id == alarm_id))).scalar()
    if not r:
        raise HTTPException(status_code=404, detail="Alarm not found")
    r.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(r)
    dev = (await db.execute(select(Device).where(Device.id == r.device_id))).scalar()
    return AlarmOut(
        id=r.id, device_id=r.device_id,
        device_code=dev.device_code if dev else "?", device_name=dev.name if dev else "?",
        alarm_type=r.alarm_type, alarm_code=r.alarm_code, message=r.message,
        acknowledged=r.acknowledged, ack_by=r.ack_by,
        ack_at=r.ack_at.isoformat() if r.ack_at else None,
        resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


# ── Unresolved count (for nav badge) ──

@router.get("/unresolved-count")
async def get_unresolved_count(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(
        select(func.count(AlarmLog.id)).where(AlarmLog.resolved_at == None)
    )).scalar() or 0
    return {"count": total}

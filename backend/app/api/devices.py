"""Device management API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.device import Device
from app.models.template import ProtocolTemplate
from app.services.collector import CollectorService
from pydantic import BaseModel
from typing import Optional

from datetime import datetime, timedelta
from app.models.timeseries import TimeSeriesData
from app.models.alarm import AlarmLog
from app.models.aggregated import AggregatedMetric
from app.models.template import TemplateItem

router = APIRouter(prefix="/api/devices", tags=["devices"])

collector: CollectorService | None = None


def set_collector(c: CollectorService):
    global collector
    collector = c


class DeviceCreate(BaseModel):
    device_code: str
    name: str
    brand: str
    model: str
    workshop: str = ""
    ip: str
    port: int = 502
    slave_id: int = 1
    template_id: str | None = None
    interval: int = 5
    enabled: bool = True


class DeviceUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    model: str | None = None
    workshop: str | None = None
    ip: str | None = None
    port: int | None = None
    slave_id: int | None = None
    template_id: str | None = None
    interval: int | None = None
    enabled: bool | None = None


class DeviceOut(BaseModel):
    id: str
    device_code: str
    name: str
    brand: str
    model: str
    workshop: str
    ip: str
    port: int
    slave_id: int
    template_id: str | None
    template_name: str | None = None
    interval: int
    enabled: bool
    online_status: str
    run_status: str
    last_seen: str | None = None

    model_config = {"from_attributes": True}


def _device_to_out(dev: Device) -> DeviceOut:
    runtime_status = {"online_status": "offline", "run_status": "offline"}
    if collector:
        runtime_status = collector.get_device_status(dev.id)
    return DeviceOut(
        id=dev.id,
        device_code=dev.device_code,
        name=dev.name,
        brand=dev.brand,
        model=dev.model,
        workshop=dev.workshop,
        ip=dev.ip,
        port=dev.port,
        slave_id=dev.slave_id,
        template_id=dev.template_id,
        template_name=dev.template.name if dev.template else None,
        interval=dev.interval,
        enabled=dev.enabled,
        online_status=runtime_status.get("online_status", dev.online_status),
        run_status=runtime_status.get("run_status", dev.run_status),
        last_seen=dev.last_seen.isoformat() if dev.last_seen else None,
    )


@router.get("", response_model=list[DeviceOut])
async def list_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Device).options(selectinload(Device.template))
    )
    devices = result.scalars().all()
    return [_device_to_out(d) for d in devices]


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Device).where(Device.id == device_id).options(selectinload(Device.template))
    )
    dev = result.scalar()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return _device_to_out(dev)


@router.post("", response_model=DeviceOut)
async def create_device(body: DeviceCreate, db: AsyncSession = Depends(get_db)):
    dev = Device(**body.model_dump())
    db.add(dev)
    await db.commit()
    await db.refresh(dev)
    return _device_to_out(dev)


@router.put("/{device_id}", response_model=DeviceOut)
async def update_device(device_id: str, body: DeviceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).where(Device.id == device_id))
    dev = result.scalar()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(dev, field, value)
    await db.commit()
    await db.refresh(dev)
    return _device_to_out(dev)


@router.delete("/{device_id}")
async def delete_device(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).where(Device.id == device_id))
    dev = result.scalar()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    await db.delete(dev)
    await db.commit()
    return {"ok": True}


# ── Device detail: real-time metrics ──

class MetricItem(BaseModel):
    item_id: str
    item_name: str
    value: float
    unit: str
    timestamp: str | None = None


@router.get("/{device_id}/metrics", response_model=list[MetricItem])
async def get_device_metrics(device_id: str, db: AsyncSession = Depends(get_db)):
    """Return the latest register value for every template item of a device."""
    dev = await db.execute(select(Device).where(Device.id == device_id).options(selectinload(Device.template)))
    dev = dev.scalar()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    if not dev.template:
        return []

    items = (await db.execute(
        select(TemplateItem).where(TemplateItem.template_id == dev.template_id).order_by(TemplateItem.sort_order)
    )).scalars().all()

    result: list[MetricItem] = []
    for item in items:
        latest = await db.execute(
            select(TimeSeriesData.converted_value, TimeSeriesData.timestamp)
            .where(TimeSeriesData.device_id == device_id, TimeSeriesData.item_id == item.id)
            .order_by(TimeSeriesData.timestamp.desc())
            .limit(1)
        )
        row = latest.first()
        result.append(MetricItem(
            item_id=item.id,
            item_name=item.item_name,
            value=row[0] if row else 0.0,
            unit=item.unit,
            timestamp=row[1].isoformat() if row and row[1] else None,
        ))
    return result


# ── Device detail: historical timeseries ──

class TimeseriesPoint(BaseModel):
    timestamp: str
    value: float


@router.get("/{device_id}/timeseries", response_model=list[TimeseriesPoint])
async def get_device_timeseries(
    device_id: str,
    item_id: str,
    start: str | None = None,
    end: str | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
):
    """Return timeseries data for a specific template item."""
    q = (
        select(TimeSeriesData.timestamp, TimeSeriesData.converted_value)
        .where(TimeSeriesData.device_id == device_id, TimeSeriesData.item_id == item_id)
    )
    if start:
        q = q.where(TimeSeriesData.timestamp >= datetime.fromisoformat(start))
    if end:
        q = q.where(TimeSeriesData.timestamp <= datetime.fromisoformat(end))
    rows = (await db.execute(q.order_by(TimeSeriesData.timestamp.asc()).limit(limit))).all()
    return [TimeseriesPoint(timestamp=r[0].isoformat(), value=r[1]) for r in rows]


# ── Device detail: alarm history ──

class AlarmItem(BaseModel):
    id: str
    alarm_type: str
    alarm_code: str | None = None
    message: str
    acknowledged: bool
    created_at: str | None = None
    resolved_at: str | None = None

    model_config = {"from_attributes": True}


@router.get("/{device_id}/alarms", response_model=list[AlarmItem])
async def get_device_alarms(
    device_id: str,
    limit: int = 20,
    acknowledged: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return alarm history for a device."""
    q = select(AlarmLog).where(AlarmLog.device_id == device_id)
    if acknowledged is not None:
        q = q.where(AlarmLog.acknowledged == acknowledged)
    rows = (await db.execute(q.order_by(AlarmLog.created_at.desc()).limit(limit))).scalars().all()
    return [AlarmItem.model_validate(r) for r in rows]


# ── Device detail: aggregated stats ──

class AggregationItem(BaseModel):
    period_key: str
    output_count: float
    availability: float
    run_duration: float
    standby_duration: float
    fault_duration: float
    offline_duration: float


@router.get("/{device_id}/aggregation", response_model=list[AggregationItem])
async def get_device_aggregation(
    device_id: str,
    period_type: str = "day",
    days: int = 7,
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated metrics (daily/weekly/monthly) for a device."""
    since = datetime.utcnow().date() - timedelta(days=days)
    rows = (await db.execute(
        select(AggregatedMetric)
        .where(
            AggregatedMetric.device_id == device_id,
            AggregatedMetric.period_type == period_type,
            AggregatedMetric.period_key >= since.isoformat(),
        )
        .order_by(AggregatedMetric.period_key.asc())
    )).scalars().all()
    return [
        AggregationItem(
            period_key=r.period_key,
            output_count=r.output_count,
            availability=r.availability,
            run_duration=r.run_duration,
            standby_duration=r.standby_duration,
            fault_duration=r.fault_duration,
            offline_duration=r.offline_duration,
        )
        for r in rows
    ]

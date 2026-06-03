"""Dashboard overview and metrics API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.device import Device
from app.models.timeseries import TimeSeriesData
from app.models.aggregated import AggregatedMetric
from app.models.alarm import AlarmLog
from app.models.template import TemplateItem
from app.services.aggregator import AggregatorService
from pydantic import BaseModel
from datetime import date, datetime, timedelta, timezone

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

aggregator: AggregatorService | None = None


def set_aggregator(a: AggregatorService):
    global aggregator
    aggregator = a


class OverviewOut(BaseModel):
    online_count: int
    total_count: int
    today_output: float
    overall_availability: float
    alarm_count: int


@router.get("/overview", response_model=OverviewOut)
async def get_overview(db: AsyncSession = Depends(get_db)):
    devices_result = await db.execute(select(Device))
    devices = devices_result.scalars().all()
    online = sum(1 for d in devices if d.enabled)
    today = date.today().isoformat()

    today_output = await db.execute(
        select(func.sum(AggregatedMetric.output_count)).where(
            AggregatedMetric.period_type == "day",
            AggregatedMetric.period_key == today,
        )
    )
    output = today_output.scalar() or 0.0

    avail = await db.execute(
        select(func.avg(AggregatedMetric.availability)).where(
            AggregatedMetric.period_type == "day",
            AggregatedMetric.period_key == today,
        )
    )
    availability = avail.scalar() or 0.0

    alarms = await db.execute(
        select(func.count(AlarmLog.id)).where(AlarmLog.resolved_at == None)
    )
    alarm_count = alarms.scalar() or 0

    return OverviewOut(
        online_count=online,
        total_count=len(devices),
        today_output=output,
        overall_availability=round(availability, 1),
        alarm_count=alarm_count,
    )


class DeviceSnapshot(BaseModel):
    id: str
    device_code: str
    name: str
    brand: str
    model: str
    workshop: str
    online_status: str
    run_status: str
    current_output: float
    run_duration_hours: float
    alarm_info: str | None


@router.get("/snapshots", response_model=list[DeviceSnapshot])
async def get_device_snapshots(
    status: str | None = Query(None),
    workshop: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Device)
    if workshop:
        query = query.where(Device.workshop == workshop)
    result = await db.execute(query)
    devices = result.scalars().all()

    snapshots = []
    from app.api.devices import collector
    today = date.today().isoformat()

    for dev in devices:
        runtime_status = {"online_status": "offline", "run_status": "offline"}
        if collector:
            runtime_status = collector.get_device_status(dev.id)

        if status and runtime_status.get("run_status") != status and runtime_status.get("online_status") != status:
            continue

        # Today's output for this device
        out_row = await db.execute(
            select(AggregatedMetric.output_count).where(
                AggregatedMetric.device_id == dev.id,
                AggregatedMetric.period_type == "day",
                AggregatedMetric.period_key == today,
            )
        )
        current_output = out_row.scalar() or 0.0

        # Latest alarm
        alarm_row = await db.execute(
            select(AlarmLog.message).where(
                AlarmLog.device_id == dev.id,
                AlarmLog.resolved_at == None,
            ).order_by(AlarmLog.created_at.desc()).limit(1)
        )
        alarm_info = alarm_row.scalar()

        snapshots.append(DeviceSnapshot(
            id=dev.id,
            device_code=dev.device_code,
            name=dev.name,
            brand=dev.brand,
            model=dev.model,
            workshop=dev.workshop,
            online_status=runtime_status.get("online_status", "offline"),
            run_status=runtime_status.get("run_status", "offline"),
            current_output=current_output,
            run_duration_hours=0.0,
            alarm_info=alarm_info,
        ))

    return snapshots


@router.get("/charts/daily-output")
async def get_daily_output_chart(device_id: str, days: int = 7):
    if aggregator:
        return await aggregator.get_device_daily_output(device_id, days)
    return []

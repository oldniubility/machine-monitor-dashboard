"""Reports API — production, OEE, workshop summaries."""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.device import Device
from app.models.aggregated import AggregatedMetric
from pydantic import BaseModel

router = APIRouter(prefix="/api/reports", tags=["reports"])


# ── Schemas ──

class ProductionRow(BaseModel):
    device_code: str
    device_name: str
    workshop: str
    period_key: str
    output_count: float
    availability: float


class OEERow(BaseModel):
    device_id: str
    device_code: str
    device_name: str
    availability: float
    run_hours: float
    standby_hours: float
    fault_hours: float
    offline_hours: float


class WorkshopSummary(BaseModel):
    workshop: str
    device_count: int
    online_count: int
    total_output: float
    avg_availability: float


# ── Production Report ──

@router.get("/production", response_model=list[ProductionRow])
async def get_production_report(
    start: str | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end: str | None = Query(None, description="End date (YYYY-MM-DD)"),
    workshop: str | None = Query(None),
    device_id: str | None = Query(None),
    period_type: str = Query("day", description="day / week / month"),
    db: AsyncSession = Depends(get_db),
):
    """Cross-device production output report."""
    today = date.today()
    start_date = date.fromisoformat(start) if start else today - timedelta(days=7)
    end_date = date.fromisoformat(end) if end else today

    # Build device filter
    dev_q = select(Device)
    if device_id:
        dev_q = dev_q.where(Device.id == device_id)
    if workshop:
        dev_q = dev_q.where(Device.workshop == workshop)
    devices = (await db.execute(dev_q)).scalars().all()

    results: list[ProductionRow] = []
    for dev in devices:
        rows = (await db.execute(
            select(AggregatedMetric)
            .where(
                AggregatedMetric.device_id == dev.id,
                AggregatedMetric.period_type == period_type,
                AggregatedMetric.period_key >= start_date.isoformat(),
                AggregatedMetric.period_key <= end_date.isoformat(),
            )
            .order_by(AggregatedMetric.period_key.asc())
        )).scalars().all()
        for r in rows:
            results.append(ProductionRow(
                device_code=dev.device_code,
                device_name=dev.name,
                workshop=dev.workshop,
                period_key=r.period_key,
                output_count=r.output_count,
                availability=r.availability,
            ))
    return results


# ── OEE / Availability Report ──

@router.get("/oee", response_model=list[OEERow])
async def get_oee_report(
    start: str | None = Query(None),
    end: str | None = Query(None),
    device_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated OEE / availability report."""
    today = date.today()
    start_date = date.fromisoformat(start) if start else today - timedelta(days=7)
    end_date = date.fromisoformat(end) if end else today

    dev_q = select(Device)
    if device_id:
        dev_q = dev_q.where(Device.id == device_id)
    devices = (await db.execute(dev_q)).scalars().all()

    results: list[OEERow] = []
    for dev in devices:
        stats = (await db.execute(
            select(
                func.avg(AggregatedMetric.availability),
                func.sum(AggregatedMetric.run_duration),
                func.sum(AggregatedMetric.standby_duration),
                func.sum(AggregatedMetric.fault_duration),
                func.sum(AggregatedMetric.offline_duration),
            ).where(
                AggregatedMetric.device_id == dev.id,
                AggregatedMetric.period_type == "day",
                AggregatedMetric.period_key >= start_date.isoformat(),
                AggregatedMetric.period_key <= end_date.isoformat(),
            )
        )).first()
        results.append(OEERow(
            device_id=dev.id,
            device_code=dev.device_code,
            device_name=dev.name,
            availability=round(stats[0] or 0.0, 1),
            run_hours=round(stats[1] or 0.0, 1),
            standby_hours=round(stats[2] or 0.0, 1),
            fault_hours=round(stats[3] or 0.0, 1),
            offline_hours=round(stats[4] or 0.0, 1),
        ))
    return results


# ── Workshop Summary ──

@router.get("/workshop-summary", response_model=list[WorkshopSummary])
async def get_workshop_summary(
    target_date: str | None = Query(None, description="Target date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Per-workshop summary: online count, total output, average availability."""
    td = date.fromisoformat(target_date) if target_date else date.today()
    period_key = td.isoformat()

    devices = (await db.execute(select(Device))).scalars().all()

    # Group by workshop
    workshops: dict[str, list[Device]] = {}
    for d in devices:
        ws = d.workshop or "未分配"
        workshops.setdefault(ws, []).append(d)

    results: list[WorkshopSummary] = []
    for ws_name, ws_devices in workshops.items():
        dev_ids = [d.id for d in ws_devices]
        online = sum(1 for d in ws_devices if d.enabled)

        agg = (await db.execute(
            select(
                func.sum(AggregatedMetric.output_count),
                func.avg(AggregatedMetric.availability),
            ).where(
                AggregatedMetric.device_id.in_(dev_ids),
                AggregatedMetric.period_type == "day",
                AggregatedMetric.period_key == period_key,
            )
        )).first()

        results.append(WorkshopSummary(
            workshop=ws_name,
            device_count=len(ws_devices),
            online_count=online,
        total_output=round(agg[0] or 0.0, 1),
        avg_availability=round(agg[1] or 0.0, 1),
    ))
    return results


# ── CSV Export ──

@router.get("/production/csv")
async def export_production_csv(
    start: str | None = Query(None),
    end: str | None = Query(None),
    workshop: str | None = Query(None),
    device_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Export production report as CSV."""
    today = date.today()
    start_date = date.fromisoformat(start) if start else today - timedelta(days=30)
    end_date = date.fromisoformat(end) if end else today

    dev_q = select(Device)
    if device_id:
        dev_q = dev_q.where(Device.id == device_id)
    if workshop:
        dev_q = dev_q.where(Device.workshop == workshop)
    devices = (await db.execute(dev_q)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["设备编号", "设备名称", "车间", "日期", "产量(件)", "稼动率(%)"])

    for dev in devices:
        rows = (await db.execute(
            select(AggregatedMetric)
            .where(
                AggregatedMetric.device_id == dev.id,
                AggregatedMetric.period_type == "day",
                AggregatedMetric.period_key >= start_date.isoformat(),
                AggregatedMetric.period_key <= end_date.isoformat(),
            )
            .order_by(AggregatedMetric.period_key.asc())
        )).scalars().all()
        for r in rows:
            writer.writerow([
                dev.device_code, dev.name, dev.workshop,
                r.period_key, r.output_count, r.availability,
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=production_{start_date}_{end_date}.csv"},
    )

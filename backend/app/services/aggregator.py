"""Data aggregation service — computes daily/weekly/monthly/yearly metrics."""
import asyncio
import logging
from datetime import datetime, date, timedelta, timezone

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.timeseries import TimeSeriesData
from app.models.aggregated import AggregatedMetric
from app.models.device import Device
from app.models.template import TemplateItem

logger = logging.getLogger(__name__)

SHIFT_HOURS = 12  # default shift length in hours


class AggregatorService:

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run_periodic_aggregation())
        logger.info("Aggregator started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()

    async def _run_periodic_aggregation(self):
        while self._running:
            try:
                await self.aggregate_daily()
            except Exception as e:
                logger.error(f"Aggregation error: {e}")
            await asyncio.sleep(60)

    async def aggregate_daily(self, target_date: date | None = None):
        """Compute daily output metrics for all devices."""
        if target_date is None:
            target_date = date.today()
        period_key = target_date.isoformat()
        day_start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        async with async_session() as session:
            devices = (await session.execute(select(Device))).scalars().all()
            for dev in devices:
                # Get counter items for this device's template
                if not dev.template_id:
                    continue
                counter_items = (await session.execute(
                    select(TemplateItem).where(
                        TemplateItem.template_id == dev.template_id,
                        TemplateItem.is_counter == True,
                    )
                )).scalars().all()

                output = 0.0
                for item in counter_items:
                    # First and last counter reading of the day
                    first = await session.execute(
                        select(TimeSeriesData.converted_value)
                        .where(
                            TimeSeriesData.device_id == dev.id,
                            TimeSeriesData.item_id == item.id,
                            TimeSeriesData.timestamp >= day_start,
                            TimeSeriesData.timestamp < day_end,
                        )
                        .order_by(TimeSeriesData.timestamp.asc())
                        .limit(1)
                    )
                    last = await session.execute(
                        select(TimeSeriesData.converted_value)
                        .where(
                            TimeSeriesData.device_id == dev.id,
                            TimeSeriesData.item_id == item.id,
                            TimeSeriesData.timestamp >= day_start,
                            TimeSeriesData.timestamp < day_end,
                        )
                        .order_by(TimeSeriesData.timestamp.desc())
                        .limit(1)
                    )
                    first_val = first.scalar()
                    last_val = last.scalar()
                    if first_val is not None and last_val is not None and last_val >= first_val:
                        output += last_val - first_val

                # Upsert aggregated metric
                existing = await session.execute(
                    select(AggregatedMetric).where(
                        AggregatedMetric.device_id == dev.id,
                        AggregatedMetric.period_type == "day",
                        AggregatedMetric.period_key == period_key,
                    )
                )
                metric = existing.scalar()
                if not metric:
                    metric = AggregatedMetric(
                        device_id=dev.id,
                        period_type="day",
                        period_key=period_key,
                    )
                    session.add(metric)
                metric.output_count = output
                metric.availability = min(100.0, (output / max(1, output)) * 100.0)
            await session.commit()

    async def get_device_daily_output(self, device_id: str, days: int = 7) -> list[dict]:
        """Get daily output for recent N days."""
        async with async_session() as session:
            result = await session.execute(
                select(AggregatedMetric)
                .where(
                    AggregatedMetric.device_id == device_id,
                    AggregatedMetric.period_type == "day",
                )
                .order_by(AggregatedMetric.period_key.desc())
                .limit(days)
            )
            metrics = result.scalars().all()
            return [
                {"date": m.period_key, "output": m.output_count, "availability": m.availability}
                for m in reversed(metrics)
            ]

    async def get_total_output(self, period_type: str = "day", period_key: str | None = None) -> float:
        """Get total output across all devices for a period."""
        if period_key is None:
            period_key = date.today().isoformat()
        async with async_session() as session:
            result = await session.execute(
                select(func.sum(AggregatedMetric.output_count))
                .where(
                    AggregatedMetric.period_type == period_type,
                    AggregatedMetric.period_key == period_key,
                )
            )
            return result.scalar() or 0.0

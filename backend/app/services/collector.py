"""Data collection engine — polls Modbus devices and stores time-series data."""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.device import Device
from app.models.timeseries import TimeSeriesData
from app.models.alarm import AlarmLog
from app.models.template import TemplateItem
from app.core.modbus_client import ModbusReader, STATUS_MAP
from app.config import settings

logger = logging.getLogger(__name__)


class CollectorService:
    """Manages polling of all enabled devices."""

    def __init__(self):
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False
        self._device_status: dict[str, dict] = {}
        self._offline_counts: dict[str, int] = {}
        self._last_counter: dict[str, dict[str, float]] = {}

    async def start(self):
        self._running = True
        async with async_session() as session:
            devices = await self._load_devices(session)
        for dev in devices:
            self._start_device_task(dev)
        logger.info(f"Collector started, monitoring {len(devices)} devices")

    async def stop(self):
        self._running = False
        for tid, task in self._tasks.items():
            task.cancel()
        self._tasks.clear()

    async def _load_devices(self, session: AsyncSession) -> list[Device]:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        result = await session.execute(
            select(Device).where(Device.enabled == True).options(selectinload(Device.template))
        )
        return list(result.scalars().all())

    def _start_device_task(self, dev: Device):
        if dev.id in self._tasks:
            self._tasks[dev.id].cancel()
        self._tasks[dev.id] = asyncio.create_task(self._poll_device(dev))

    async def _poll_device(self, dev: Device):
        reader = ModbusReader(dev.ip, dev.port, dev.slave_id)
        items = dev.template.items if dev.template else []
        counter_items = [it for it in items if it.is_counter]
        status_item = next((it for it in items if it.item_name == "运行状态" or "状态" in it.item_name), None)

        while self._running:
            try:
                results = await reader.read_all_items(items)
                if any(v.get("raw") is None for v in results.values()):
                    # All reads failed — device offline
                    self._offline_counts[dev.id] = self._offline_counts.get(dev.id, 0) + 1
                    if self._offline_counts[dev.id] >= settings.offline_threshold:
                        await self._mark_offline(dev.id)
                else:
                    self._offline_counts[dev.id] = 0
                    # Determine run status from status register
                    new_status = "running"
                    if status_item and status_item.id in results:
                        raw = results[status_item.id].get("raw")
                        if raw is not None:
                            new_status = STATUS_MAP.get(int(raw), "running")

                    prev_status = self._device_status.get(dev.id, {}).get("run_status", "offline")
                    if new_status == "fault" and prev_status != "fault":
                        await self._log_alarm(dev.id, "fault", f"设备 {dev.name} 发生故障")

                    self._device_status[dev.id] = {
                        "online_status": "online",
                        "run_status": new_status,
                        "last_seen": datetime.now(timezone.utc),
                    }

                    # Store time-series data
                    async with async_session() as session:
                        for item in items:
                            r = results.get(item.id, {})
                            if r.get("raw") is not None:
                                session.add(TimeSeriesData(
                                    device_id=dev.id,
                                    item_id=item.id,
                                    raw_value=r["raw"],
                                    converted_value=r["converted"],
                                    quality=0,
                                ))
                        await session.commit()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Poll error device={dev.name}: {e}")

            await asyncio.sleep(dev.interval)

    async def _mark_offline(self, device_id: str):
        prev = self._device_status.get(device_id, {})
        self._device_status[device_id] = {"online_status": "offline", "run_status": "offline"}
        if prev.get("online_status") != "offline":
            await self._log_alarm(device_id, "offline", f"设备离线")

    async def _log_alarm(self, device_id: str, alarm_type: str, message: str):
        async with async_session() as session:
            from sqlalchemy import select
            dev = (await session.execute(select(Device).where(Device.id == device_id))).scalar()
            session.add(AlarmLog(device_id=device_id, alarm_type=alarm_type, message=message))
            await session.commit()
            # Push to WebSocket
            from app.api.ws import broadcast
            broadcast.push_alarm({
                "device_id": device_id,
                "device_code": dev.device_code if dev else "?",
                "device_name": dev.name if dev else "?",
                "alarm_type": alarm_type,
                "message": message,
                "created_at": datetime.utcnow().isoformat(),
            })

    def get_device_status(self, device_id: str) -> dict:
        return self._device_status.get(device_id, {"online_status": "offline", "run_status": "offline"})

    def get_all_statuses(self) -> dict[str, dict]:
        return dict(self._device_status)

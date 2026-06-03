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

"""Protocol template management API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.template import ProtocolTemplate, TemplateItem, RegisterType, DataType, ByteOrder
from pydantic import BaseModel

router = APIRouter(prefix="/api/templates", tags=["templates"])


# ── Schemas ──

class ItemIn(BaseModel):
    item_name: str
    register_type: str = "holding"
    address: int = 0
    data_type: str = "uint16"
    byte_order: str = "big_endian"
    scale: float = 1.0
    unit: str = ""
    read_write: str = "ro"
    is_counter: bool = False
    sort_order: int = 0


class ItemOut(BaseModel):
    id: str
    template_id: str
    item_name: str
    register_type: str
    address: int
    data_type: str
    byte_order: str
    scale: float
    unit: str
    read_write: str
    is_counter: bool
    sort_order: int

    model_config = {"from_attributes": True}


class TemplateIn(BaseModel):
    name: str
    brand: str
    model: str
    version: int = 1
    description: str = ""
    items: list[ItemIn] = []


class TemplateUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    model: str | None = None
    version: int | None = None
    description: str | None = None
    items: list[ItemIn] | None = None


class TemplateOut(BaseModel):
    id: str
    name: str
    brand: str
    model: str
    version: int
    description: str
    items: list[ItemOut] = []

    model_config = {"from_attributes": True}


def _template_to_out(tmpl: ProtocolTemplate) -> TemplateOut:
    return TemplateOut(
        id=tmpl.id, name=tmpl.name, brand=tmpl.brand,
        model=tmpl.model, version=tmpl.version, description=tmpl.description,
        items=[ItemOut.model_validate(i) for i in (tmpl.items or [])],
    )


# ── List ──

@router.get("", response_model=list[TemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(ProtocolTemplate).options(selectinload(ProtocolTemplate.items))
        .order_by(ProtocolTemplate.created_at.desc())
    )).scalars().all()
    return [_template_to_out(t) for t in rows]


# ── Get one ──

@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)):
    tmpl = (await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == template_id)
        .options(selectinload(ProtocolTemplate.items))
    )).scalar()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_out(tmpl)


# ── Create ──

@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(body: TemplateIn, db: AsyncSession = Depends(get_db)):
    tmpl = ProtocolTemplate(
        name=body.name, brand=body.brand, model=body.model,
        version=body.version, description=body.description,
    )
    db.add(tmpl)
    await db.flush()
    for item in body.items:
        db.add(TemplateItem(
            template_id=tmpl.id,
            item_name=item.item_name,
            register_type=RegisterType(item.register_type),
            address=item.address,
            data_type=DataType(item.data_type),
            byte_order=ByteOrder(item.byte_order),
            scale=item.scale, unit=item.unit,
            read_write=item.read_write,
            is_counter=item.is_counter,
            sort_order=item.sort_order,
        ))
    await db.commit()
    await db.refresh(tmpl)
    # Reload with items
    tmpl = (await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == tmpl.id)
        .options(selectinload(ProtocolTemplate.items))
    )).scalar()
    return _template_to_out(tmpl)


# ── Update ──

@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(template_id: str, body: TemplateUpdate, db: AsyncSession = Depends(get_db)):
    tmpl = (await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == template_id)
        .options(selectinload(ProtocolTemplate.items))
    )).scalar()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    for field in ("name", "brand", "model", "version", "description"):
        v = getattr(body, field, None)
        if v is not None:
            setattr(tmpl, field, v)

    if body.items is not None:
        # Delete existing items
        for item in list(tmpl.items):
            await db.delete(item)
        # Add new items
        for item in body.items:
            db.add(TemplateItem(
                template_id=tmpl.id,
                item_name=item.item_name,
                register_type=RegisterType(item.register_type),
                address=item.address,
                data_type=DataType(item.data_type),
                byte_order=ByteOrder(item.byte_order),
                scale=item.scale, unit=item.unit,
                read_write=item.read_write,
                is_counter=item.is_counter,
                sort_order=item.sort_order,
            ))

    await db.commit()
    # Reload
    tmpl = (await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == template_id)
        .options(selectinload(ProtocolTemplate.items))
    )).scalar()
    return _template_to_out(tmpl)


# ── Delete ──

@router.delete("/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    tmpl = (await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == template_id)
    )).scalar()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tmpl)
    await db.commit()
    return {"ok": True}

"""Protocol template and template item models."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Enum as SAEnum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class RegisterType(str, enum.Enum):
    coil = "coil"
    discrete = "discrete"
    holding = "holding"
    input_reg = "input"


class DataType(str, enum.Enum):
    uint16 = "uint16"
    int16 = "int16"
    uint32 = "uint32"
    int32 = "int32"
    float32 = "float32"


class ByteOrder(str, enum.Enum):
    big_endian = "big_endian"
    little_endian = "little_endian"
    word_swap = "word_swap"


class ProtocolTemplate(Base):
    __tablename__ = "protocol_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(64), comment="模板名称")
    brand: Mapped[str] = mapped_column(String(32), comment="品牌")
    model: Mapped[str] = mapped_column(String(32), comment="型号")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="版本号")
    description: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    items: Mapped[list["TemplateItem"]] = relationship("TemplateItem", back_populates="template", cascade="all, delete-orphan", lazy="selectin")


class TemplateItem(Base):
    __tablename__ = "template_items"

    id: Mapped[str] = mapped_column(String(36), primary_key, default=lambda: str(uuid.uuid4()))
    template_id: Mapped[str] = mapped_column(String(36), ForeignKey("protocol_templates.id"), nullable=False)
    item_name: Mapped[str] = mapped_column(String(64), comment="指标名称")
    register_type: Mapped[RegisterType] = mapped_column(SAEnum(RegisterType), comment="寄存器类型")
    address: Mapped[int] = mapped_column(Integer, comment="起始地址(偏移量)")
    data_type: Mapped[DataType] = mapped_column(SAEnum(DataType), comment="数据类型")
    byte_order: Mapped[ByteOrder] = mapped_column(SAEnum(ByteOrder), default=ByteOrder.big_endian)
    scale: Mapped[float] = mapped_column(Float, default=1.0, comment="缩放系数")
    unit: Mapped[str] = mapped_column(String(16), default="", comment="单位")
    read_write: Mapped[str] = mapped_column(String(8), default="ro", comment="ro/rw")
    is_counter: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否为生产计数类型")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped["ProtocolTemplate"] = relationship("ProtocolTemplate", back_populates="items")

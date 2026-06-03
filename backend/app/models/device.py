"""Device model - represents a monitored machine tool."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, comment="设备唯一编号")
    name: Mapped[str] = mapped_column(String(64), comment="设备名称")
    brand: Mapped[str] = mapped_column(String(32), comment="品牌")
    model: Mapped[str] = mapped_column(String(32), comment="型号")
    workshop: Mapped[str] = mapped_column(String(64), default="", comment="所属车间/产线")
    ip: Mapped[str] = mapped_column(String(15), comment="IP地址")
    port: Mapped[int] = mapped_column(Integer, default=502, comment="端口")
    slave_id: Mapped[int] = mapped_column(Integer, default=1, comment="从站ID")
    template_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("protocol_templates.id"), nullable=True, comment="关联协议模板ID")
    interval: Mapped[int] = mapped_column(Integer, default=5, comment="采集间隔(秒)")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")
    online_status: Mapped[str] = mapped_column(String(16), default="offline", comment="在线状态: online/offline")
    run_status: Mapped[str] = mapped_column(String(16), default="offline", comment="运行状态: running/standby/fault/offline")
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="最后在线时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    template: Mapped["ProtocolTemplate | None"] = relationship("ProtocolTemplate", foreign_keys=[template_id], lazy="selectin")

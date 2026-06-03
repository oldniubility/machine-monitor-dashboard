"""Time series raw data model."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TimeSeriesData(Base):
    __tablename__ = "timeseries_data"

    id: Mapped[str] = mapped_column(String(36), primary_key, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True, comment="设备ID")
    item_id: Mapped[str] = mapped_column(String(36), index=True, comment="指标项ID")
    raw_value: Mapped[float] = mapped_column(Float, comment="原始值")
    converted_value: Mapped[float] = mapped_column(Float, comment="换算值")
    quality: Mapped[int] = mapped_column(Integer, default=0, comment="数据质量: 0=好")
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True, server_default=func.now())

    __table_args__ = (
        Index("idx_ts_device_item_time", "device_id", "item_id", "timestamp"),
    )

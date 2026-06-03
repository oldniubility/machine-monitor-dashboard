"""Aggregated metrics model."""
import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AggregatedMetric(Base):
    __tablename__ = "aggregated_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    period_type: Mapped[str] = mapped_column(String(16), comment="day/week/month/year/shift")
    period_key: Mapped[str] = mapped_column(String(32), comment="周期标识如2026-06-03")
    shift_name: Mapped[str | None] = mapped_column(String(16), nullable=True, comment="班次名称")
    output_count: Mapped[float] = mapped_column(Float, default=0.0, comment="产量")
    run_duration: Mapped[float] = mapped_column(Float, default=0.0, comment="运行时长(小时)")
    standby_duration: Mapped[float] = mapped_column(Float, default=0.0)
    fault_duration: Mapped[float] = mapped_column(Float, default=0.0)
    offline_duration: Mapped[float] = mapped_column(Float, default=0.0)
    availability: Mapped[float] = mapped_column(Float, default=0.0, comment="稼动率(%)")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_agg_device_period", "device_id", "period_type", "period_key", unique=True),
    )

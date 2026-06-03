"""Alarm log model."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AlarmLog(Base):
    __tablename__ = "alarm_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    alarm_type: Mapped[str] = mapped_column(String(32), comment="fault/offline/communication_error")
    alarm_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message: Mapped[str] = mapped_column(String(256))
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    ack_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ack_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

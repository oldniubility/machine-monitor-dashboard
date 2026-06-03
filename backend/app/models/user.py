"""User model for authentication and permissions."""
import uuid
import hashlib
import secrets
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Hash password with salt using SHA-256. Returns (hash, salt)."""
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return h, salt


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    """Verify password against stored hash."""
    h, _ = hash_password(password, salt)
    return h == stored_hash


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    salt: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(16), default="viewer", comment="admin / operator / viewer")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

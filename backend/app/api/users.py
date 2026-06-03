"""User management API — admin-only endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User, hash_password
from app.api.auth import get_current_user, require_role
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    created_at: str | None = None


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    rows = (await db.execute(select(User).order_by(User.created_at.desc()))).scalars().all()
    return [
        UserOut(
            id=u.id, username=u.username, role=u.role,
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in rows
    ]


@router.post("", response_model=UserOut)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    existing = (await db.execute(select(User).where(User.username == body.username))).scalar()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    if body.role not in ("admin", "operator", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    pw_hash, salt = hash_password(body.password)
    user = User(username=body.username, password_hash=pw_hash, salt=salt, role=body.role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut(
        id=user.id, username=user.username, role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    await db.delete(user)
    await db.commit()
    return {"ok": True}

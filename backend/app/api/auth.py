"""Authentication API — register, login, current user."""
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, hash_password, verify_password
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-memory token store (token → {user_id, role, expires})
_tokens: dict[str, dict] = {}
TOKEN_TTL = 86400  # 24 hours


def _clean_expired():
    now = time.time()
    expired = [k for k, v in _tokens.items() if v["expires"] < now]
    for k in expired:
        del _tokens[k]


def create_token(user_id: str, role: str) -> str:
    _clean_expired()
    token = secrets.token_urlsafe(32)
    _tokens[token] = {"user_id": user_id, "role": role, "expires": time.time() + TOKEN_TTL}
    return token


def verify_token(token: str) -> dict | None:
    _clean_expired()
    return _tokens.get(token)


async def get_current_user(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency: extract and validate user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization[7:]
    info = verify_token(token)
    if not info:
        raise HTTPException(status_code=401, detail="Token expired or invalid")
    user = (await db.execute(select(User).where(User.id == info["user_id"]))).scalar()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    """Dependency factory: require one of the given roles."""
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# ── Schemas ──

class RegisterBody(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class LoginBody(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    role: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ── Endpoints ──

@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
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
    token = create_token(user.id, user.role)
    return AuthResponse(token=token, user=UserOut(id=user.id, username=user.username, role=user.role))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.username == body.username))).scalar()
    if not user or not verify_password(body.password, user.salt, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(user.id, user.role)
    return AuthResponse(token=token, user=UserOut(id=user.id, username=user.username, role=user.role))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, username=user.username, role=user.role)

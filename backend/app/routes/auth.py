from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import (
    create_jwt_token,
    get_current_user,
    get_or_create_user,
    verify_github_token,
    verify_google_token,
)
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class OAuthTokenRequest(BaseModel):
    access_token: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None
    avatar_url: str | None
    provider: str | None


@router.post("/google", response_model=AuthResponse)
async def auth_google(body: OAuthTokenRequest, db: Session = Depends(get_db)):
    """Authenticate with a Google OAuth access token."""
    user_info = await verify_google_token(body.access_token)
    user = get_or_create_user(
        db=db,
        email=user_info["email"],
        name=user_info["name"],
        avatar_url=user_info["avatar_url"],
        provider="google",
    )
    token = create_jwt_token(user.id, user.email)
    return AuthResponse(
        token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
            "provider": user.provider,
        },
    )


@router.post("/github", response_model=AuthResponse)
async def auth_github(body: OAuthTokenRequest, db: Session = Depends(get_db)):
    """Authenticate with a GitHub OAuth access token."""
    user_info = await verify_github_token(body.access_token)
    user = get_or_create_user(
        db=db,
        email=user_info["email"],
        name=user_info["name"],
        avatar_url=user_info["avatar_url"],
        provider="github",
    )
    token = create_jwt_token(user.id, user.email)
    return AuthResponse(
        token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
            "provider": user.provider,
        },
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        provider=user.provider,
    )

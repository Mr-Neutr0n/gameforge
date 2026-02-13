from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import Conversation, Game, User

router = APIRouter(prefix="/api/games", tags=["games"])


# ── Schemas ──────────────────────────────────────────────────────────────


class GameCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=5000)
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    template_type: str | None = Field(None, pattern="^(platformer|topdown|shooter|puzzle|custom)$")


class GameUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    is_public: bool | None = None


class ConversationOut(BaseModel):
    id: str
    role: str
    content: str
    step_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GameOut(BaseModel):
    id: str
    user_id: str
    title: str | None
    description: str | None
    prompt: str | None
    game_code: str | None
    thumbnail_url: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GameDetailOut(GameOut):
    conversations: list[ConversationOut] = []

    model_config = {"from_attributes": True}


class GamePublicOut(BaseModel):
    id: str
    title: str | None
    description: str | None
    game_code: str | None
    thumbnail_url: str | None
    is_public: bool
    created_at: datetime
    creator_name: str | None = None

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────


def _get_user_game(db: Session, game_id: str, user_id: str) -> Game:
    """Fetch a game owned by the given user or raise 404."""
    game = db.query(Game).filter(Game.id == game_id, Game.user_id == user_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get("", response_model=list[GameOut])
async def list_games(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all games for the authenticated user, newest first."""
    games = (
        db.query(Game)
        .filter(Game.user_id == user.id)
        .order_by(Game.created_at.desc())
        .all()
    )
    return games


@router.get("/{game_id}", response_model=GameDetailOut)
async def get_game(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single game with its conversation history."""
    game = (
        db.query(Game)
        .options(joinedload(Game.conversations))
        .filter(Game.id == game_id, Game.user_id == user.id)
        .first()
    )
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    game.conversations.sort(key=lambda c: c.created_at)
    return game


@router.post("", response_model=GameOut, status_code=status.HTTP_201_CREATED)
async def create_game(
    body: GameCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new game from a prompt."""
    game = Game(
        user_id=user.id,
        title=body.title,
        description=body.description,
        prompt=body.prompt,
    )
    db.add(game)

    # Store the initial user prompt as a conversation entry
    conversation = Conversation(
        game_id=game.id,
        role="user",
        content=body.prompt,
        step_type="user",
    )
    db.add(conversation)

    db.commit()
    db.refresh(game)
    return game


@router.patch("/{game_id}", response_model=GameOut)
async def update_game(
    game_id: str,
    body: GameUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update game metadata (title, description, visibility)."""
    game = _get_user_game(db, game_id, user.id)

    if body.title is not None:
        game.title = body.title
    if body.description is not None:
        game.description = body.description
    if body.is_public is not None:
        game.is_public = body.is_public

    game.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(game)
    return game


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a game and all associated data."""
    game = _get_user_game(db, game_id, user.id)
    db.delete(game)
    db.commit()


@router.get("/{game_id}/public", response_model=GamePublicOut)
async def get_public_game(
    game_id: str,
    db: Session = Depends(get_db),
):
    """Get a public game (no auth required)."""
    game = (
        db.query(Game)
        .options(joinedload(Game.user))
        .filter(Game.id == game_id, Game.is_public.is_(True))
        .first()
    )
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    return GamePublicOut(
        id=game.id,
        title=game.title,
        description=game.description,
        game_code=game.game_code,
        thumbnail_url=game.thumbnail_url,
        is_public=game.is_public,
        created_at=game.created_at,
        creator_name=game.user.name if game.user else None,
    )

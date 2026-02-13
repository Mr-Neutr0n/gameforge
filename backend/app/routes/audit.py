from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import AuditResult, AuditType, Game, User
from app.audits.logic_audit import run_logic_audit

router = APIRouter(prefix="/api/games", tags=["audits"])


# ── Schemas ──────────────────────────────────────────────────────────────


class AuditCheckDetail(BaseModel):
    check: str
    passed: bool
    message: str


class AuditResultOut(BaseModel):
    id: str
    game_id: str
    audit_type: str
    passed: bool
    score: int
    details: dict | None
    created_at: str

    model_config = {"from_attributes": True}


class AuditResponse(BaseModel):
    passed: bool
    score: int
    details: list[AuditCheckDetail]
    audit_id: str


# ── Helpers ──────────────────────────────────────────────────────────────


def _get_user_game(db: Session, game_id: str, user_id: str) -> Game:
    """Fetch a game owned by the given user or raise 404."""
    game = db.query(Game).filter(Game.id == game_id, Game.user_id == user_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post("/{game_id}/audit/logic", response_model=AuditResponse)
async def audit_logic(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run logic audit on a game's generated code.

    Checks structural correctness: Phaser.Game constructor, scenes,
    lifecycle methods, player entity, input handling, infinite loops,
    and score/state tracking.
    """
    game = _get_user_game(db, game_id, user.id)

    if not game.game_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has no generated code to audit",
        )

    result = run_logic_audit(game.game_code)

    # Persist the audit result
    audit_record = AuditResult(
        game_id=game.id,
        audit_type=AuditType.logic,
        passed=result["passed"],
        score=result["score"],
        details={"checks": result["details"]},
    )
    db.add(audit_record)
    db.commit()
    db.refresh(audit_record)

    return AuditResponse(
        passed=result["passed"],
        score=result["score"],
        details=result["details"],
        audit_id=audit_record.id,
    )

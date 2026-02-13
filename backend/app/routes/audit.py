from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import AuditResult, AuditType, Game, User
from app.audits.logic_audit import run_logic_audit
from app.audits.ui_audit import run_ui_audit
from app.audits.code_audit import run_code_audit
from app.audits.orchestrator import run_all_audits

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
    created_at: datetime

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


@router.post("/{game_id}/audit/ui", response_model=AuditResponse)
async def audit_ui(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run UI audit on a game's generated code.

    Checks visual/UI correctness: canvas dimensions, background color,
    font sizes, viewport fit, and overlapping UI elements.
    """
    game = _get_user_game(db, game_id, user.id)

    if not game.game_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has no generated code to audit",
        )

    result = run_ui_audit(game.game_code)

    audit_record = AuditResult(
        game_id=game.id,
        audit_type=AuditType.ui,
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


@router.post("/{game_id}/audit/code", response_model=AuditResponse)
async def audit_code(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run code quality audit on a game's generated code.

    Checks code quality and security: no eval/Function, no var declarations,
    scene cleanup, no direct DOM access, no navigation calls, no external
    network requests, and proper this. usage in scene methods.
    """
    game = _get_user_game(db, game_id, user.id)

    if not game.game_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has no generated code to audit",
        )

    result = run_code_audit(game.game_code)

    audit_record = AuditResult(
        game_id=game.id,
        audit_type=AuditType.code,
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


# ── Orchestrator & retrieval endpoints ────────────────────────────────


class AuditSummaryItem(BaseModel):
    passed: bool
    score: int
    audit_id: str


class AuditAllResponse(BaseModel):
    overall_score: int
    overall_passed: bool
    audits: dict[str, AuditSummaryItem]


@router.post("/{game_id}/audit/all", response_model=AuditAllResponse)
async def audit_all(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run all audits (logic, UI, code) on a game and store results.

    Returns a summary with per-audit scores and an overall quality score.
    """
    game = _get_user_game(db, game_id, user.id)

    if not game.game_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has no generated code to audit",
        )

    summary = run_all_audits(game.game_code, game.id, db)

    return AuditAllResponse(
        overall_score=summary["overall_score"],
        overall_passed=summary["overall_passed"],
        audits={
            k: AuditSummaryItem(
                passed=v["passed"],
                score=v["score"],
                audit_id=v["audit_id"],
            )
            for k, v in summary["audits"].items()
        },
    )


@router.get("/{game_id}/audits", response_model=list[AuditResultOut])
async def get_audit_results(
    game_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the most recent audit result for each audit type for a game."""
    game = _get_user_game(db, game_id, user.id)

    results = (
        db.query(AuditResult)
        .filter(AuditResult.game_id == game.id)
        .order_by(AuditResult.created_at.desc())
        .all()
    )

    # Keep only the most recent per audit type
    seen_types: set[str] = set()
    latest: list[AuditResult] = []
    for r in results:
        audit_type_val = r.audit_type.value if hasattr(r.audit_type, "value") else r.audit_type
        if audit_type_val not in seen_types:
            seen_types.add(audit_type_val)
            latest.append(r)

    return latest


@router.get("/{game_id}/audits/public")
async def get_public_audit_summary(
    game_id: str,
    db: Session = Depends(get_db),
):
    """Get audit quality summary for a public game (no auth required).

    Returns the overall quality score and per-audit pass status for
    display on the public share page.
    """
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.is_public.is_(True))
        .first()
    )
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    results = (
        db.query(AuditResult)
        .filter(AuditResult.game_id == game.id)
        .order_by(AuditResult.created_at.desc())
        .all()
    )

    # Keep only the most recent per audit type
    seen_types: set[str] = set()
    latest: list[AuditResult] = []
    for r in results:
        audit_type_val = r.audit_type.value if hasattr(r.audit_type, "value") else r.audit_type
        if audit_type_val not in seen_types:
            seen_types.add(audit_type_val)
            latest.append(r)

    if not latest:
        return {"overall_score": 0, "has_audits": False, "audits": {}}

    scores = [r.score for r in latest]
    overall = int(sum(scores) / len(scores))

    audits = {}
    for r in latest:
        audit_type_val = r.audit_type.value if hasattr(r.audit_type, "value") else r.audit_type
        audits[audit_type_val] = {
            "passed": r.passed,
            "score": r.score,
        }

    return {
        "overall_score": overall,
        "has_audits": True,
        "audits": audits,
    }

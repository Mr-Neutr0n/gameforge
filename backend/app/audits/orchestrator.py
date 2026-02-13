"""Audit orchestrator — runs all audit types and stores results.

After game generation completes, the orchestrator runs logic, UI, and code
quality audits, persists each result to the audit_results table, and returns
a combined summary with an overall quality score.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.audits.code_audit import run_code_audit
from app.audits.logic_audit import run_logic_audit
from app.audits.ui_audit import run_ui_audit
from app.models import AuditResult, AuditType

logger = logging.getLogger(__name__)


def run_all_audits(game_code: str, game_id: str, db: Session) -> dict:
    """Run all three audits on the given game code and persist results.

    Args:
        game_code: The Phaser.js game source code.
        game_id: The game record ID for storing results.
        db: Active SQLAlchemy session.

    Returns:
        A dict with keys:
            audits: dict mapping audit_type to {passed, score, details, audit_id}
            overall_score: int 0-100 (average of all audit scores)
            overall_passed: bool (True only if all audits passed)
    """
    audit_runners = [
        (AuditType.logic, run_logic_audit),
        (AuditType.ui, run_ui_audit),
        (AuditType.code, run_code_audit),
    ]

    audits: dict[str, dict] = {}

    for audit_type, runner in audit_runners:
        try:
            result = runner(game_code)
        except Exception:
            logger.exception(
                "Audit %s failed for game %s", audit_type.value, game_id
            )
            result = {
                "passed": False,
                "score": 0,
                "details": [
                    {
                        "check": "audit_error",
                        "passed": False,
                        "message": f"Audit {audit_type.value} encountered an internal error",
                    }
                ],
            }

        # Persist to DB
        record = AuditResult(
            game_id=game_id,
            audit_type=audit_type,
            passed=result["passed"],
            score=result["score"],
            details={"checks": result["details"]},
            created_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.flush()  # Get the ID without committing

        audits[audit_type.value] = {
            "passed": result["passed"],
            "score": result["score"],
            "details": result["details"],
            "audit_id": record.id,
        }

    db.commit()

    scores = [a["score"] for a in audits.values()]
    overall_score = int(sum(scores) / len(scores)) if scores else 0
    overall_passed = all(a["passed"] for a in audits.values())

    return {
        "audits": audits,
        "overall_score": overall_score,
        "overall_passed": overall_passed,
    }

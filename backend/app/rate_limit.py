"""Request throttles and persistent daily AI generation quotas."""

import os
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import DailyGenerationQuota


limiter = Limiter(key_func=get_remote_address)

MAX_GAMES_PER_USER_PER_DAY = 10
GLOBAL_GENERATIONS_PER_DAY = int(os.getenv("GLOBAL_GENERATIONS_PER_DAY", "100"))
USER_GENERATIONS_PER_DAY = int(os.getenv("USER_GENERATIONS_PER_DAY", "2"))


def consume_generation_quota(
    db: Session,
    user_id: str,
    *,
    now: datetime | None = None,
    global_limit: int | None = None,
    user_limit: int | None = None,
) -> dict[str, int]:
    """Atomically charge one generation or iteration attempt.

    PostgreSQL transactions use an advisory lock scoped to the UTC date so the
    global and user counters are checked and incremented as one operation.
    """
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    quota_date = current.astimezone(timezone.utc).date()
    global_max = global_limit or GLOBAL_GENERATIONS_PER_DAY
    user_max = user_limit or USER_GENERATIONS_PER_DAY

    try:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
                {"lock_key": f"gameforge-generation:{quota_date.isoformat()}"},
            )

        global_row = db.get(
            DailyGenerationQuota, (quota_date, "global", "all")
        )
        user_row = db.get(
            DailyGenerationQuota, (quota_date, "user", user_id)
        )
        global_count = global_row.attempts if global_row else 0
        user_count = user_row.attempts if user_row else 0

        if global_count >= global_max:
            db.rollback()
            raise _quota_error("The daily GameForge generation limit has been reached.", current)
        if user_count >= user_max:
            db.rollback()
            raise _quota_error("Your daily GameForge generation limit has been reached.", current)

        if global_row is None:
            global_row = DailyGenerationQuota(
                quota_date=quota_date,
                scope="global",
                scope_key="all",
                attempts=0,
            )
            db.add(global_row)
        if user_row is None:
            user_row = DailyGenerationQuota(
                quota_date=quota_date,
                scope="user",
                scope_key=user_id,
                attempts=0,
            )
            db.add(user_row)

        global_row.attempts += 1
        user_row.attempts += 1
        db.commit()
        return {
            "global_remaining": global_max - global_row.attempts,
            "user_remaining": user_max - user_row.attempts,
        }
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise


def _quota_error(message: str, current: datetime) -> HTTPException:
    tomorrow = current.astimezone(timezone.utc).date() + timedelta(days=1)
    retry_at = datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={"message": message, "retry_at": retry_at.isoformat()},
    )

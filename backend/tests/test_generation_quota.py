from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models import DailyGenerationQuota
from app.rate_limit import consume_generation_quota


NOW = datetime(2026, 8, 29, 12, 0, tzinfo=timezone.utc)


def test_user_daily_limit_counts_generation_and_iteration_attempts(db, test_user):
    first = consume_generation_quota(db, test_user.id, now=NOW)
    second = consume_generation_quota(db, test_user.id, now=NOW)

    assert first["user_remaining"] == 1
    assert second["user_remaining"] == 0
    with pytest.raises(HTTPException) as exc:
        consume_generation_quota(db, test_user.id, now=NOW)
    assert exc.value.status_code == 429

    global_row = db.get(DailyGenerationQuota, (NOW.date(), "global", "all"))
    user_row = db.get(DailyGenerationQuota, (NOW.date(), "user", test_user.id))
    assert global_row.attempts == 2
    assert user_row.attempts == 2


def test_global_limit_rejects_without_incrementing_user(db, test_user):
    consume_generation_quota(
        db, test_user.id, now=NOW, global_limit=1, user_limit=10
    )

    with pytest.raises(HTTPException) as exc:
        consume_generation_quota(
            db, "another-user", now=NOW, global_limit=1, user_limit=10
        )
    assert exc.value.status_code == 429
    assert db.get(
        DailyGenerationQuota, (NOW.date(), "user", "another-user")
    ) is None


def test_quota_resets_on_next_utc_day(db, test_user):
    consume_generation_quota(
        db, test_user.id, now=NOW, global_limit=1, user_limit=1
    )
    tomorrow = datetime(2026, 8, 30, 0, 0, tzinfo=timezone.utc)
    result = consume_generation_quota(
        db, test_user.id, now=tomorrow, global_limit=1, user_limit=1
    )
    assert result == {"global_remaining": 0, "user_remaining": 0}

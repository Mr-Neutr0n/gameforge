from sqlalchemy.exc import SQLAlchemyError


def test_readiness_check_runs_database_query(client):
    response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "gameforge-api"}


def test_readiness_check_hides_database_error(client, db, monkeypatch):
    def fail_query(*args, **kwargs):
        raise SQLAlchemyError("sensitive database details")

    monkeypatch.setattr(db, "execute", fail_query)

    response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "service": "gameforge-api",
    }
    assert "sensitive" not in response.text

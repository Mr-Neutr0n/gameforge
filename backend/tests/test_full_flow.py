"""Full integration tests for the GameForge pipeline.

Tests the complete flow:
1. Create a game with a platformer prompt
2. Run the full agent pipeline (mocked ADK — generates working Phaser code)
3. Assert game_code is generated and non-empty
4. Assert game_code contains `new Phaser.Game`
5. Run all 3 audits and assert logic audit passes
6. Test iteration with "make the player red instead of blue"
7. Assert updated code contains the color change

Uses an in-memory SQLite database and mocks the ADK runner to avoid
real Gemini API calls while exercising the full route → DB → audit stack.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.models import AuditResult, Conversation, Game, User
from tests.conftest import SAMPLE_ITERATED_CODE, SAMPLE_PLATFORMER_CODE


# ---------------------------------------------------------------------------
# Helpers — mock ADK event factories
# ---------------------------------------------------------------------------


class _MockActions:
    """Mimics google.adk.events.Event.actions with a state_delta."""

    def __init__(self, state_delta: dict | None = None):
        self.state_delta = state_delta


class _MockPart:
    def __init__(self, text: str):
        self.text = text


class _MockContent:
    def __init__(self, parts: list[_MockPart]):
        self.parts = parts


class _MockEvent:
    """Mimics a google.adk.events.Event yielded by Runner.run_async."""

    def __init__(
        self,
        author: str = "coordinator",
        state_delta: dict | None = None,
        text: str | None = None,
    ):
        self.author = author
        self.actions = _MockActions(state_delta)
        self.content = _MockContent([_MockPart(text)]) if text else None


def _make_generation_events(game_code: str) -> list[_MockEvent]:
    """Build a sequence of mock ADK events simulating the full pipeline."""
    plan = json.dumps({
        "game_title": "Blue Square Platformer",
        "game_type": "platformer",
        "scenes": [
            {"name": "BootScene", "description": "Boot and transition"},
            {"name": "GameScene", "description": "Main gameplay scene"},
        ],
        "mechanics": {
            "controls": "Arrow keys — left/right move, up jumps",
            "enemies": "None",
            "scoring": "Score increments on platform reach",
            "win_condition": "None — endless play",
            "lose_condition": "None",
        },
        "assets_needed": [
            {"name": "player", "description": "32x32 blue square"},
            {"name": "platform", "description": "200x20 green rectangle"},
        ],
    })

    return [
        # Progress message from coordinator
        _MockEvent(
            author="coordinator",
            state_delta={"progress_messages": ["Starting planning phase..."]},
        ),
        # Planner outputs the game plan
        _MockEvent(
            author="planner",
            state_delta={"game_plan": plan},
        ),
        # Progress message from generator
        _MockEvent(
            author="code_generator",
            state_delta={
                "progress_messages": [
                    "Starting planning phase...",
                    "Generating Phaser.js code...",
                ],
            },
        ),
        # Generator writes game code
        _MockEvent(
            author="code_generator",
            state_delta={"game_files": {"game.js": game_code}},
        ),
        # Validator reports success
        _MockEvent(
            author="validator",
            state_delta={
                "validation_result": json.dumps({
                    "valid": True,
                    "errors": [],
                    "warnings": [],
                })
            },
        ),
    ]


def _make_iteration_events(updated_code: str) -> list[_MockEvent]:
    """Build mock ADK events simulating an iteration run."""
    return [
        _MockEvent(
            author="iterator",
            state_delta={
                "progress_messages": ["Analyzing change request..."],
            },
        ),
        _MockEvent(
            author="iterator",
            state_delta={"game_files": {"game.js": updated_code}},
        ),
        _MockEvent(
            author="iterator",
            text="Changed the player color from blue to red.",
        ),
    ]


# ---------------------------------------------------------------------------
# Mock async generators for the runner functions
# ---------------------------------------------------------------------------


async def _mock_run_game_generation(prompt, game_id, template_type=None):
    """Async generator yielding mock events for game generation."""
    for event in _make_generation_events(SAMPLE_PLATFORMER_CODE):
        yield event


async def _mock_run_game_iteration(
    message, game_id, existing_code, conversation_context=None
):
    """Async generator yielding mock events for game iteration."""
    for event in _make_iteration_events(SAMPLE_ITERATED_CODE):
        yield event


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestFullGameFlow:
    """End-to-end integration test exercising the complete GameForge pipeline."""

    # -- Step 1: Create a game with a prompt --------------------------------

    def test_create_game_with_prompt(self, client, auth_headers, test_user, db):
        """Create a new game record from a text prompt."""
        response = client.post(
            "/api/games",
            json={
                "prompt": "a simple platformer where a blue square jumps on green platforms",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text
        data = response.json()

        assert data["id"]
        assert data["user_id"] == test_user.id
        assert "platformer" in data["prompt"]
        assert data["game_code"] is None  # Not generated yet
        assert data["is_public"] is False

    # -- Step 2 & 3: Run generation pipeline, assert code produced ----------

    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_generate_game_produces_code(
        self, mock_gen, client, auth_headers, test_game, db
    ):
        """Run the agent pipeline and verify game_code is generated."""
        response = client.post(
            f"/api/games/{test_game.id}/generate",
            json={
                "prompt": "a simple platformer where a blue square jumps on green platforms",
                "template_type": "platformer",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200, response.text

        # Parse all SSE events from the stream
        events = _parse_sse_events(response.text)

        # Must have at least a thinking, code, validation, and complete event
        event_types = [e["type"] for e in events]
        assert "thinking" in event_types, f"No thinking event found. Events: {event_types}"
        assert "code" in event_types, f"No code event found. Events: {event_types}"
        assert "complete" in event_types, f"No complete event found. Events: {event_types}"

        # Extract the complete event
        complete_event = next(e for e in events if e["type"] == "complete")
        game_code = complete_event["game_code"]

        # Assertions from task spec
        assert game_code is not None
        assert len(game_code) > 0
        assert "new Phaser.Game" in game_code

        # Verify DB was updated
        db.expire_all()
        game = db.query(Game).filter(Game.id == test_game.id).first()
        assert game.game_code is not None
        assert len(game.game_code) > 0
        assert "new Phaser.Game" in game.game_code

        # Title should have been auto-extracted from plan
        assert game.title is not None
        assert len(game.title) > 0

    # -- Step 4: Assert Phaser.Game is in the generated code ----------------

    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_generated_code_contains_phaser_game(
        self, mock_gen, client, auth_headers, test_game, db
    ):
        """Verify the generated code contains a Phaser.Game constructor."""
        response = client.post(
            f"/api/games/{test_game.id}/generate",
            json={"prompt": test_game.prompt},
            headers=auth_headers,
        )
        assert response.status_code == 200

        events = _parse_sse_events(response.text)
        code_events = [e for e in events if e["type"] == "code"]
        assert len(code_events) > 0

        code = code_events[0]["content"]
        assert "new Phaser.Game" in code
        assert "Phaser.Scene" in code
        assert "create()" in code or "create ()" in code
        assert "update()" in code or "update(" in code

    # -- Step 5: Run all 3 audits and assert logic audit passes -------------

    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_audits_pass_on_generated_code(
        self, mock_gen, client, auth_headers, test_game, db
    ):
        """Run all audits on the generated code; logic audit must pass."""
        # First, generate the game
        response = client.post(
            f"/api/games/{test_game.id}/generate",
            json={"prompt": test_game.prompt},
            headers=auth_headers,
        )
        assert response.status_code == 200

        # The generation endpoint auto-runs audits — check the SSE stream
        events = _parse_sse_events(response.text)
        audit_events = [e for e in events if e["type"] == "audit"]

        # Audit event should have been emitted
        assert len(audit_events) > 0, "No audit event emitted during generation"
        audit_data = audit_events[0]
        assert "overall_score" in audit_data
        assert "audits" in audit_data

        # Also run audits explicitly via the API
        # Logic audit
        resp_logic = client.post(
            f"/api/games/{test_game.id}/audit/logic",
            headers=auth_headers,
        )
        assert resp_logic.status_code == 200, resp_logic.text
        logic_result = resp_logic.json()
        assert logic_result["passed"] is True, (
            f"Logic audit failed: {logic_result['details']}"
        )
        assert logic_result["score"] == 100

        # UI audit
        resp_ui = client.post(
            f"/api/games/{test_game.id}/audit/ui",
            headers=auth_headers,
        )
        assert resp_ui.status_code == 200, resp_ui.text
        ui_result = resp_ui.json()
        assert ui_result["score"] > 0

        # Code audit
        resp_code = client.post(
            f"/api/games/{test_game.id}/audit/code",
            headers=auth_headers,
        )
        assert resp_code.status_code == 200, resp_code.text
        code_result = resp_code.json()
        assert code_result["score"] > 0

    # -- Step 5b: Run all audits via orchestrator endpoint ------------------

    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_audit_all_endpoint(
        self, mock_gen, client, auth_headers, test_game, db
    ):
        """Run all audits via the /audit/all endpoint."""
        # Generate first
        client.post(
            f"/api/games/{test_game.id}/generate",
            json={"prompt": test_game.prompt},
            headers=auth_headers,
        )

        resp = client.post(
            f"/api/games/{test_game.id}/audit/all",
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert "overall_score" in data
        assert "overall_passed" in data
        assert "audits" in data
        assert "logic" in data["audits"]
        assert "ui" in data["audits"]
        assert "code" in data["audits"]
        assert data["audits"]["logic"]["passed"] is True

    # -- Step 6 & 7: Iterate and verify color change ------------------------

    @patch(
        "app.agents.runner.run_game_iteration",
        side_effect=_mock_run_game_iteration,
    )
    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_iterate_changes_player_color(
        self, mock_gen, mock_iter, client, auth_headers, test_game, db
    ):
        """Iterate on a generated game to change player color from blue to red."""
        # First, generate the game
        gen_response = client.post(
            f"/api/games/{test_game.id}/generate",
            json={"prompt": test_game.prompt},
            headers=auth_headers,
        )
        assert gen_response.status_code == 200

        # Verify original code has blue color (0x3b82f6)
        db.expire_all()
        game = db.query(Game).filter(Game.id == test_game.id).first()
        assert "0x3b82f6" in game.game_code

        # Now iterate: request color change
        iter_response = client.post(
            f"/api/games/{test_game.id}/iterate",
            json={"message": "make the player red instead of blue"},
            headers=auth_headers,
        )
        assert iter_response.status_code == 200

        # Parse iteration SSE events
        events = _parse_sse_events(iter_response.text)
        event_types = [e["type"] for e in events]
        assert "code" in event_types, f"No code event in iteration. Events: {event_types}"
        assert "complete" in event_types

        # Extract the updated code
        complete_event = next(e for e in events if e["type"] == "complete")
        updated_code = complete_event["game_code"]

        # Verify the color change
        assert "0xff0000" in updated_code, "Updated code should contain red color (0xff0000)"
        assert "red square" in updated_code.lower() or "0xff0000" in updated_code

        # Verify DB was updated
        db.expire_all()
        game = db.query(Game).filter(Game.id == test_game.id).first()
        assert "0xff0000" in game.game_code


class TestConversationHistory:
    """Tests for conversation storage during generation and iteration."""

    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_conversation_saved_during_generation(
        self, mock_gen, client, auth_headers, test_game, db
    ):
        """Verify conversation entries are saved during generation."""
        client.post(
            f"/api/games/{test_game.id}/generate",
            json={"prompt": test_game.prompt},
            headers=auth_headers,
        )

        conversations = (
            db.query(Conversation)
            .filter(Conversation.game_id == test_game.id)
            .order_by(Conversation.created_at.asc())
            .all()
        )

        # Should have at least: user prompt, plan, code, validation
        assert len(conversations) >= 3, (
            f"Expected at least 3 conversation entries, got {len(conversations)}: "
            f"{[(c.role, c.step_type) for c in conversations]}"
        )

        # First should be the user prompt
        roles = [c.role for c in conversations]
        step_types = [c.step_type for c in conversations]
        assert "user" in roles
        assert "user" in step_types

    @patch(
        "app.agents.runner.run_game_iteration",
        side_effect=_mock_run_game_iteration,
    )
    @patch(
        "app.agents.runner.run_game_generation",
        side_effect=_mock_run_game_generation,
    )
    def test_conversation_saved_during_iteration(
        self, mock_gen, mock_iter, client, auth_headers, test_game, db
    ):
        """Verify conversation entries are saved during iteration."""
        # Generate
        client.post(
            f"/api/games/{test_game.id}/generate",
            json={"prompt": test_game.prompt},
            headers=auth_headers,
        )

        count_before = (
            db.query(Conversation)
            .filter(Conversation.game_id == test_game.id)
            .count()
        )

        # Iterate
        client.post(
            f"/api/games/{test_game.id}/iterate",
            json={"message": "make the player red"},
            headers=auth_headers,
        )

        count_after = (
            db.query(Conversation)
            .filter(Conversation.game_id == test_game.id)
            .count()
        )

        # Iteration should add at least the user message + code update
        assert count_after > count_before


class TestAuditsDirectly:
    """Tests for the audit functions themselves (no HTTP, no mocking)."""

    def test_logic_audit_passes_for_valid_code(self):
        """Logic audit should pass for well-structured Phaser code."""
        from app.audits.logic_audit import run_logic_audit

        result = run_logic_audit(SAMPLE_PLATFORMER_CODE)
        assert result["passed"] is True, (
            f"Logic audit failed: {result['details']}"
        )
        assert result["score"] == 100

    def test_logic_audit_fails_for_empty_code(self):
        """Logic audit should fail for empty code."""
        from app.audits.logic_audit import run_logic_audit

        result = run_logic_audit("")
        assert result["passed"] is False
        assert result["score"] == 0

    def test_ui_audit_passes_for_valid_code(self):
        """UI audit should pass for code with proper dimensions and colors."""
        from app.audits.ui_audit import run_ui_audit

        result = run_ui_audit(SAMPLE_PLATFORMER_CODE)
        assert result["passed"] is True, (
            f"UI audit failed: {result['details']}"
        )

    def test_code_audit_checks_for_valid_code(self):
        """Code audit should score well for clean Phaser code."""
        from app.audits.code_audit import run_code_audit

        result = run_code_audit(SAMPLE_PLATFORMER_CODE)
        assert result["score"] > 0
        # Check individual checks
        check_names = [d["check"] for d in result["details"]]
        assert "no_eval_or_function" in check_names
        assert "no_var_declarations" in check_names
        assert "no_direct_dom_access" in check_names
        assert "no_navigation_calls" in check_names
        assert "no_external_requests" in check_names

    def test_logic_audit_fails_for_code_without_phaser(self):
        """Logic audit should fail for code without Phaser constructs."""
        from app.audits.logic_audit import run_logic_audit

        result = run_logic_audit("console.log('hello world');")
        assert result["passed"] is False
        assert result["score"] < 50

    def test_code_audit_detects_eval(self):
        """Code audit should flag eval() usage."""
        from app.audits.code_audit import run_code_audit

        bad_code = SAMPLE_PLATFORMER_CODE + "\neval('alert(1)');"
        result = run_code_audit(bad_code)
        eval_check = next(
            d for d in result["details"] if d["check"] == "no_eval_or_function"
        )
        assert eval_check["passed"] is False

    def test_audit_orchestrator(self, db, test_game):
        """Run the audit orchestrator and verify DB persistence."""
        from app.audits.orchestrator import run_all_audits

        # Set game_code on the game so the orchestrator can audit it
        test_game.game_code = SAMPLE_PLATFORMER_CODE
        db.commit()

        summary = run_all_audits(SAMPLE_PLATFORMER_CODE, test_game.id, db)

        assert "audits" in summary
        assert "overall_score" in summary
        assert "overall_passed" in summary
        assert summary["overall_score"] > 0

        # Verify records were persisted
        records = (
            db.query(AuditResult)
            .filter(AuditResult.game_id == test_game.id)
            .all()
        )
        assert len(records) == 3  # logic, ui, code
        audit_types = {r.audit_type.value for r in records}
        assert audit_types == {"logic", "ui", "code"}


class TestGameCRUD:
    """Tests for game creation, retrieval, update, and deletion."""

    def test_create_game(self, client, auth_headers, test_user):
        """Create a game and verify the response."""
        resp = client.post(
            "/api/games",
            json={"prompt": "a puzzle game with falling blocks"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["prompt"] == "a puzzle game with falling blocks"
        assert data["user_id"] == test_user.id

    def test_list_games(self, client, auth_headers, test_game):
        """List games should return the user's games."""
        resp = client.get("/api/games", headers=auth_headers)
        assert resp.status_code == 200
        games = resp.json()
        assert len(games) >= 1
        assert any(g["id"] == test_game.id for g in games)

    def test_get_game(self, client, auth_headers, test_game):
        """Get a single game by ID."""
        resp = client.get(f"/api/games/{test_game.id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_game.id

    def test_update_game(self, client, auth_headers, test_game):
        """Update game metadata."""
        resp = client.patch(
            f"/api/games/{test_game.id}",
            json={"title": "My Platformer", "is_public": True},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "My Platformer"
        assert data["is_public"] is True

    def test_delete_game(self, client, auth_headers, test_game, db):
        """Delete a game."""
        resp = client.delete(
            f"/api/games/{test_game.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

        # Verify it's gone
        game = db.query(Game).filter(Game.id == test_game.id).first()
        assert game is None

    def test_get_nonexistent_game_returns_404(self, client, auth_headers):
        """Getting a non-existent game should return 404."""
        resp = client.get(
            "/api/games/nonexistent-id",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_unauthenticated_request_rejected(self, client):
        """Requests without auth should be rejected (401 or 403)."""
        resp = client.get("/api/games")
        assert resp.status_code in (401, 403)


class TestPublicGameAccess:
    """Tests for public game access without authentication."""

    def test_public_game_accessible(self, client, db, test_game):
        """A public game should be accessible without auth."""
        test_game.is_public = True
        test_game.game_code = SAMPLE_PLATFORMER_CODE
        test_game.title = "Public Platformer"
        db.commit()

        resp = client.get(f"/api/games/{test_game.id}/public")
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Public Platformer"
        assert data["game_code"] is not None

    def test_private_game_not_accessible_publicly(self, client, db, test_game):
        """A private game should not be accessible via the public endpoint."""
        test_game.is_public = False
        db.commit()

        resp = client.get(f"/api/games/{test_game.id}/public")
        assert resp.status_code == 404


class TestGenerationEdgeCases:
    """Tests for edge cases in the generation and iteration flow."""

    def test_iterate_without_generation_fails(
        self, client, auth_headers, test_game
    ):
        """Iterating on a game without generated code should fail."""
        resp = client.post(
            f"/api/games/{test_game.id}/iterate",
            json={"message": "add a sword"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_generate_nonexistent_game_returns_404(
        self, client, auth_headers
    ):
        """Generating for a non-existent game should return 404."""
        resp = client.post(
            "/api/games/nonexistent-id/generate",
            json={"prompt": "a game"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_audit_without_code_returns_400(
        self, client, auth_headers, test_game
    ):
        """Running an audit on a game without code should return 400."""
        resp = client.post(
            f"/api/games/{test_game.id}/audit/logic",
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestHealthCheck:
    """Test the health check endpoint."""

    def test_health_check(self, client):
        """Health check should return OK."""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "gameforge-api"


# ---------------------------------------------------------------------------
# SSE parsing helper
# ---------------------------------------------------------------------------


def _parse_sse_events(sse_text: str) -> list[dict]:
    """Parse SSE-formatted text into a list of JSON event dicts."""
    events = []
    for line in sse_text.strip().split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            try:
                data = json.loads(line[6:])
                events.append(data)
            except json.JSONDecodeError:
                continue
    return events

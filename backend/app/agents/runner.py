"""ADK Runner setup for game generation and iteration.

Provides:
- run_game_generation() — runs the full coordinator pipeline for new games
- run_game_iteration() — runs the iterator agent to modify existing games
"""

import uuid
from collections.abc import AsyncGenerator
from typing import Any

from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from app.agents.config import APP_NAME, MAX_LLM_CALLS

# Lazy imports to avoid circular dependency — agents are built at module
# level, which imports tools/config that this module also uses.
_runner: Runner | None = None
_iterator_runner: Runner | None = None
_session_service: InMemorySessionService | None = None


def _get_session_service() -> InMemorySessionService:
    """Return the singleton InMemorySessionService."""
    global _session_service
    if _session_service is None:
        _session_service = InMemorySessionService()
    return _session_service


def _get_runner() -> Runner:
    """Return the singleton ADK Runner for the coordinator pipeline."""
    global _runner
    if _runner is None:
        from app.agents import root_agent  # noqa: deferred import

        _runner = Runner(
            app_name=APP_NAME,
            agent=root_agent,
            session_service=_get_session_service(),
        )
    return _runner


def _get_iterator_runner() -> Runner:
    """Return the singleton ADK Runner for the iterator agent."""
    global _iterator_runner
    if _iterator_runner is None:
        from app.agents.iterator import iterator_agent  # noqa: deferred import

        _iterator_runner = Runner(
            app_name=f"{APP_NAME}-iterator",
            agent=iterator_agent,
            session_service=_get_session_service(),
        )
    return _iterator_runner


async def run_game_generation(
    prompt: str,
    game_id: str,
    template_type: str | None = None,
) -> AsyncGenerator[Event, None]:
    """Run the full game-generation agent pipeline and yield ADK events.

    Creates a fresh ADK session, injects the user prompt (and optional
    template type) as initial state, then iterates through the runner's
    async event stream.

    Args:
        prompt: The user's game description.
        game_id: Database ID of the game being generated (stored in state).
        template_type: Optional template hint (platformer/topdown/shooter/puzzle).

    Yields:
        google.adk.events.Event instances as the agents execute.
    """
    runner = _get_runner()
    session_service = _get_session_service()

    user_id = f"gameforge-user-{game_id}"
    session_id = f"session-{game_id}-{uuid.uuid4().hex[:8]}"

    # Create a session with initial state
    initial_state: dict[str, Any] = {
        "game_id": game_id,
        "template_type": template_type or "custom",
        "game_files": {},
        "progress_messages": [],
    }

    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state=initial_state,
    )

    # Build the user message content
    from google.genai import types

    user_message = types.Content(
        role="user",
        parts=[types.Part(text=prompt)],
    )

    # Run the agent pipeline
    from google.adk.runners import RunConfig

    run_config = RunConfig(max_llm_calls=MAX_LLM_CALLS)

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=user_message,
        run_config=run_config,
    ):
        yield event


async def run_game_iteration(
    message: str,
    game_id: str,
    existing_code: str,
    conversation_context: list[dict[str, str]] | None = None,
) -> AsyncGenerator[Event, None]:
    """Run the iterator agent to modify an existing game and yield ADK events.

    Creates a fresh ADK session pre-loaded with the existing game code, then
    feeds the user's modification request to the iterator agent.

    Args:
        message: The user's change request.
        game_id: Database ID of the game being modified.
        existing_code: The current Phaser.js game code to modify.
        conversation_context: Optional last N conversation entries for context.
            Each entry is a dict with 'role' and 'content' keys.

    Yields:
        google.adk.events.Event instances as the iterator executes.
    """
    runner = _get_iterator_runner()
    session_service = _get_session_service()

    user_id = f"gameforge-user-{game_id}"
    session_id = f"iterate-{game_id}-{uuid.uuid4().hex[:8]}"

    # Pre-load the existing game code into session state
    initial_state: dict[str, Any] = {
        "game_id": game_id,
        "game_files": {"game.js": existing_code},
        "progress_messages": [],
    }

    # Include conversation context if provided
    if conversation_context:
        initial_state["conversation_context"] = conversation_context

    await session_service.create_session(
        app_name=f"{APP_NAME}-iterator",
        user_id=user_id,
        session_id=session_id,
        state=initial_state,
    )

    # Build the user message with the change request
    from google.genai import types

    user_message = types.Content(
        role="user",
        parts=[types.Part(text=message)],
    )

    # Iterator gets a smaller LLM budget since it's a single agent
    from google.adk.runners import RunConfig

    run_config = RunConfig(max_llm_calls=20)

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=user_message,
        run_config=run_config,
    ):
        yield event

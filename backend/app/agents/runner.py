"""ADK Runner setup for game generation.

Provides the run_game_generation() async generator that creates an ADK session,
feeds the user prompt to the coordinator agent, and yields events as the
multi-agent pipeline progresses.
"""

import uuid
from collections.abc import AsyncGenerator
from typing import Any

from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from app.agents.config import APP_NAME, MAX_LLM_CALLS

# Lazy import to avoid circular dependency — root_agent is built at module
# level in __init__.py, which imports tools/config that this module also uses.
_runner: Runner | None = None
_session_service: InMemorySessionService | None = None


def _get_session_service() -> InMemorySessionService:
    """Return the singleton InMemorySessionService."""
    global _session_service
    if _session_service is None:
        _session_service = InMemorySessionService()
    return _session_service


def _get_runner() -> Runner:
    """Return the singleton ADK Runner, creating it on first call."""
    global _runner
    if _runner is None:
        from app.agents import root_agent  # noqa: deferred import

        _runner = Runner(
            app_name=APP_NAME,
            agent=root_agent,
            session_service=_get_session_service(),
        )
    return _runner


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

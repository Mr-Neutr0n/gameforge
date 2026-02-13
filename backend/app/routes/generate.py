"""SSE streaming endpoints for game generation and iteration.

POST /api/games/{id}/generate — kicks off the ADK coordinator agent pipeline,
streams progress events to the frontend via Server-Sent Events, saves the
final game code and conversation history to the database.

POST /api/games/{id}/iterate — runs the iterator agent to modify an existing
game based on a user message, streams SSE events, saves updated code to DB.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Conversation, ConversationRole, Game, StepType, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/games", tags=["generate"])


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=5000)
    template_type: str | None = Field(
        None, pattern="^(platformer|topdown|shooter|puzzle|custom)$"
    )


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


def _save_conversation(
    db: Session,
    game_id: str,
    role: ConversationRole,
    content: str,
    step_type: StepType,
) -> None:
    """Save a conversation entry to the database."""
    entry = Conversation(
        game_id=game_id,
        role=role.value,
        content=content,
        step_type=step_type.value,
    )
    db.add(entry)
    db.commit()


@router.post("/{game_id}/generate")
async def generate_game(
    game_id: str,
    body: GenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start game generation via ADK agents, streaming progress via SSE.

    Streams events:
        - {"type": "thinking", "agent": "<name>", "content": "..."}
        - {"type": "code", "filename": "game.js", "content": "..."}
        - {"type": "validation", "valid": true/false, "errors": [...]}
        - {"type": "fix", "iteration": N}
        - {"type": "complete", "game_code": "..."}
        - {"type": "error", "message": "..."}
    """
    # Verify the game exists and belongs to the user
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == user.id)
        .first()
    )
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Game not found"
        )

    # Update the game prompt if different
    if game.prompt != body.prompt:
        game.prompt = body.prompt
        db.commit()

    async def event_stream():
        """Async generator that runs the ADK pipeline and yields SSE events."""
        from app.agents.runner import run_game_generation

        # Track state for extracting structured events
        last_progress_index = 0
        fix_iteration = 0
        final_game_code = None

        try:
            # Emit initial event
            yield _sse_event({
                "type": "thinking",
                "agent": "coordinator",
                "content": "Starting game generation pipeline...",
            })

            # Save the user prompt as a conversation entry
            _save_conversation(
                db, game_id, ConversationRole.user, body.prompt, StepType.user
            )

            async for event in run_game_generation(
                prompt=body.prompt,
                game_id=game_id,
                template_type=body.template_type,
            ):
                # Extract agent name from the event
                agent_name = getattr(event, "author", None) or "coordinator"

                # Check for new progress messages in state
                if hasattr(event, "actions") and hasattr(event.actions, "state_delta"):
                    state_delta = event.actions.state_delta
                    if state_delta and "progress_messages" in state_delta:
                        progress = state_delta["progress_messages"]
                        # Emit any new progress messages
                        for msg in progress[last_progress_index:]:
                            yield _sse_event({
                                "type": "thinking",
                                "agent": agent_name,
                                "content": msg,
                            })
                        last_progress_index = len(progress)

                    # Check for game plan in state
                    if state_delta and "game_plan" in state_delta:
                        plan_content = state_delta["game_plan"]
                        yield _sse_event({
                            "type": "thinking",
                            "agent": "planner",
                            "content": plan_content if isinstance(plan_content, str) else json.dumps(plan_content),
                        })
                        # Save plan to conversations
                        _save_conversation(
                            db,
                            game_id,
                            ConversationRole.agent,
                            plan_content if isinstance(plan_content, str) else json.dumps(plan_content),
                            StepType.plan,
                        )

                    # Check for game code in state
                    if state_delta and "game_files" in state_delta:
                        game_files = state_delta["game_files"]
                        if isinstance(game_files, dict) and "game.js" in game_files:
                            code = game_files["game.js"]
                            final_game_code = code
                            yield _sse_event({
                                "type": "code",
                                "filename": "game.js",
                                "content": code,
                            })
                            # Save code to conversations
                            _save_conversation(
                                db,
                                game_id,
                                ConversationRole.agent,
                                code,
                                StepType.code,
                            )

                    # Check for validation result in state
                    if state_delta and "validation_result" in state_delta:
                        result_raw = state_delta["validation_result"]
                        if isinstance(result_raw, str):
                            try:
                                result = json.loads(result_raw)
                            except (json.JSONDecodeError, TypeError):
                                result = {"valid": False, "errors": [result_raw]}
                        elif isinstance(result_raw, dict):
                            result = result_raw
                        else:
                            result = {"valid": False, "errors": ["Unknown validation result"]}

                        is_valid = result.get("valid", False)
                        errors = result.get("errors", [])
                        warnings = result.get("warnings", [])

                        yield _sse_event({
                            "type": "validation",
                            "valid": is_valid,
                            "errors": errors,
                            "warnings": warnings,
                        })
                        # Save validation to conversations
                        _save_conversation(
                            db,
                            game_id,
                            ConversationRole.agent,
                            json.dumps(result),
                            StepType.validate,
                        )

                        # If not valid, we're about to enter a fix iteration
                        if not is_valid:
                            fix_iteration += 1
                            yield _sse_event({
                                "type": "fix",
                                "iteration": fix_iteration,
                            })

                # Check for text content in the event (agent responses)
                if hasattr(event, "content") and event.content:
                    parts = getattr(event.content, "parts", None)
                    if parts:
                        for part in parts:
                            text = getattr(part, "text", None)
                            if text and agent_name == "fixer":
                                # Save fix to conversations
                                _save_conversation(
                                    db,
                                    game_id,
                                    ConversationRole.agent,
                                    text,
                                    StepType.fix,
                                )

            # After pipeline completes, try to get the final game code from
            # the last known state if we didn't capture it from deltas
            if final_game_code is None:
                # The runner may have stored code in session state but we
                # might have missed the delta — check the event stream ended
                logger.warning(
                    "No game code captured from state deltas for game %s",
                    game_id,
                )
                yield _sse_event({
                    "type": "error",
                    "message": "Game generation completed but no code was produced.",
                })
                return

            # Save the final game code to the database
            game_record = db.query(Game).filter(Game.id == game_id).first()
            if game_record:
                game_record.game_code = final_game_code
                game_record.updated_at = datetime.now(timezone.utc)

                # Auto-set title from plan if not already set
                if not game_record.title:
                    game_record.title = _extract_title_from_prompt(body.prompt)

                db.commit()

            yield _sse_event({
                "type": "complete",
                "game_code": final_game_code,
            })

        except Exception as e:
            logger.exception("Error during game generation for game %s", game_id)
            yield _sse_event({
                "type": "error",
                "message": str(e),
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _extract_title_from_prompt(prompt: str) -> str:
    """Generate a short title from the user prompt.

    Takes the first 50 characters of the prompt, truncating at the last
    word boundary if needed, and title-cases the result.
    """
    clean = prompt.strip()
    if len(clean) <= 50:
        return clean.title()

    truncated = clean[:50]
    last_space = truncated.rfind(" ")
    if last_space > 20:
        truncated = truncated[:last_space]
    return truncated.title() + "..."


# ---------------------------------------------------------------------------
# Iterate endpoint — modify an existing game via the iterator agent
# ---------------------------------------------------------------------------


class IterateRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


@router.post("/{game_id}/iterate")
async def iterate_game(
    game_id: str,
    body: IterateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Iterate on an existing game via the iterator agent, streaming SSE.

    The iterator agent reads the current game code from session state,
    applies the user's requested changes, validates the result, and writes
    the updated code back. Progress is streamed as SSE events.

    Streams events:
        - {"type": "thinking", "agent": "iterator", "content": "..."}
        - {"type": "code", "filename": "game.js", "content": "..."}
        - {"type": "complete", "game_code": "..."}
        - {"type": "error", "message": "..."}
    """
    # Verify the game exists and belongs to the user
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == user.id)
        .first()
    )
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Game not found"
        )

    # Game must have existing code to iterate on
    if not game.game_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has no code to iterate on. Generate a game first.",
        )

    # Load last 10 conversation entries for context
    recent_conversations = (
        db.query(Conversation)
        .filter(Conversation.game_id == game_id)
        .order_by(Conversation.created_at.desc())
        .limit(10)
        .all()
    )
    # Reverse so they're in chronological order
    recent_conversations.reverse()

    conversation_context = [
        {"role": c.role, "content": c.content}
        for c in recent_conversations
    ]

    existing_code = game.game_code

    async def event_stream():
        """Async generator that runs the iterator and yields SSE events."""
        from app.agents.runner import run_game_iteration

        last_progress_index = 0
        final_game_code = None

        try:
            # Emit initial event
            yield _sse_event({
                "type": "thinking",
                "agent": "iterator",
                "content": "Analyzing your request and current game code...",
            })

            # Save the user message as a conversation entry
            _save_conversation(
                db, game_id, ConversationRole.user, body.message, StepType.user
            )

            async for event in run_game_iteration(
                message=body.message,
                game_id=game_id,
                existing_code=existing_code,
                conversation_context=conversation_context,
            ):
                agent_name = getattr(event, "author", None) or "iterator"

                # Check for new progress messages in state
                if hasattr(event, "actions") and hasattr(event.actions, "state_delta"):
                    state_delta = event.actions.state_delta
                    if state_delta and "progress_messages" in state_delta:
                        progress = state_delta["progress_messages"]
                        for msg in progress[last_progress_index:]:
                            yield _sse_event({
                                "type": "thinking",
                                "agent": agent_name,
                                "content": msg,
                            })
                        last_progress_index = len(progress)

                    # Check for updated game code in state
                    if state_delta and "game_files" in state_delta:
                        game_files = state_delta["game_files"]
                        if isinstance(game_files, dict) and "game.js" in game_files:
                            code = game_files["game.js"]
                            final_game_code = code
                            yield _sse_event({
                                "type": "code",
                                "filename": "game.js",
                                "content": code,
                            })

                # Check for text content (iterator's summary response)
                if hasattr(event, "content") and event.content:
                    parts = getattr(event.content, "parts", None)
                    if parts:
                        for part in parts:
                            text = getattr(part, "text", None)
                            if text and agent_name == "iterator":
                                yield _sse_event({
                                    "type": "thinking",
                                    "agent": "iterator",
                                    "content": text,
                                })

            if final_game_code is None:
                logger.warning(
                    "No updated code captured from iterator for game %s",
                    game_id,
                )
                yield _sse_event({
                    "type": "error",
                    "message": "Iteration completed but no updated code was produced.",
                })
                return

            # Save the updated code to the database
            game_record = db.query(Game).filter(Game.id == game_id).first()
            if game_record:
                game_record.game_code = final_game_code
                game_record.updated_at = datetime.now(timezone.utc)
                db.commit()

            # Save the code update as a conversation entry
            _save_conversation(
                db,
                game_id,
                ConversationRole.agent,
                final_game_code,
                StepType.code,
            )

            yield _sse_event({
                "type": "complete",
                "game_code": final_game_code,
            })

        except Exception as e:
            logger.exception("Error during game iteration for game %s", game_id)
            yield _sse_event({
                "type": "error",
                "message": str(e),
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

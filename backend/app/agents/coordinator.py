"""Coordinator agent — orchestrates the full game generation pipeline.

Uses a SequentialAgent to run: planner → generator → validator → fix_loop.
The fix_loop is a LoopAgent wrapping fixer → validator with max_iterations=3.
If the validator finds no errors, the fixer detects the clean validation_result
and does nothing, and the loop completes.

before_agent_callback and after_agent_callback on each sub-agent emit progress
events via session state so the SSE streaming endpoint can relay them to the
frontend in real time.
"""

import json
import logging

from google.adk.agents import LoopAgent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

from app.agents.config import GEMINI_MODEL
from app.agents.fixer import fixer_agent
from app.agents.generator import code_generator_agent
from app.agents.planner import planner_agent
from app.agents.validator import validator_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Callback helpers — emit progress events into session state
# ---------------------------------------------------------------------------

def _emit_progress(ctx: CallbackContext, message: str) -> None:
    """Append a progress message to session state for SSE streaming."""
    progress: list = ctx.state.get("progress_messages", [])
    progress.append(message)
    ctx.state["progress_messages"] = progress


# --- Planner callbacks ---

def before_planner(callback_context: CallbackContext) -> None:
    """Called before the planner agent runs."""
    _emit_progress(callback_context, "Planning game design...")
    logger.info("Coordinator: starting planner agent")


def after_planner(callback_context: CallbackContext) -> None:
    """Called after the planner agent finishes."""
    plan = callback_context.state.get("game_plan", "")
    if plan:
        _emit_progress(callback_context, "Game plan created successfully.")
    else:
        _emit_progress(callback_context, "Warning: planner produced no plan.")
    logger.info("Coordinator: planner agent finished")


# --- Generator callbacks ---

def before_generator(callback_context: CallbackContext) -> None:
    """Called before the code generator agent runs."""
    _emit_progress(callback_context, "Generating Phaser.js game code...")
    logger.info("Coordinator: starting code generator agent")


def after_generator(callback_context: CallbackContext) -> None:
    """Called after the code generator agent finishes."""
    files = callback_context.state.get("game_files", {})
    if "game.js" in files:
        code_len = len(files["game.js"])
        _emit_progress(
            callback_context,
            f"Game code generated ({code_len} characters).",
        )
    else:
        _emit_progress(callback_context, "Warning: no game code was written.")
    logger.info("Coordinator: code generator agent finished")


# --- Validator callbacks ---

def before_validator(callback_context: CallbackContext) -> None:
    """Called before the validator agent runs."""
    _emit_progress(callback_context, "Validating game code...")
    logger.info("Coordinator: starting validator agent")


def after_validator(callback_context: CallbackContext) -> None:
    """Called after the validator agent finishes."""
    result_raw = callback_context.state.get("validation_result", "")
    # validation_result may be a JSON string or already parsed
    if isinstance(result_raw, str):
        try:
            result = json.loads(result_raw)
        except (json.JSONDecodeError, TypeError):
            result = {"valid": False, "errors": ["Could not parse validation result"]}
    else:
        result = result_raw if isinstance(result_raw, dict) else {}

    is_valid = result.get("valid", False)
    errors = result.get("errors", [])
    warnings = result.get("warnings", [])

    if is_valid:
        _emit_progress(callback_context, "Validation passed!")
    else:
        error_count = len(errors)
        _emit_progress(
            callback_context,
            f"Validation found {error_count} error(s). Attempting fixes...",
        )

    if warnings:
        _emit_progress(
            callback_context,
            f"Validation warnings: {len(warnings)}",
        )

    logger.info(
        "Coordinator: validator finished — valid=%s, errors=%d, warnings=%d",
        is_valid,
        len(errors),
        len(warnings),
    )


# --- Fixer callbacks ---

def before_fixer(callback_context: CallbackContext) -> None:
    """Called before the fixer agent runs.

    If validation already passed, return a Content response to skip the fixer
    and short-circuit the fix loop.
    """
    result_raw = callback_context.state.get("validation_result", "")
    if isinstance(result_raw, str):
        try:
            result = json.loads(result_raw)
        except (json.JSONDecodeError, TypeError):
            result = {}
    else:
        result = result_raw if isinstance(result_raw, dict) else {}

    if result.get("valid", False):
        _emit_progress(callback_context, "Code is valid — skipping fix pass.")
        logger.info("Coordinator: skipping fixer — validation already passed")
        # Return Content to skip this agent's execution
        return types.Content(
            role="model",
            parts=[types.Part(text="Validation passed. No fixes needed.")],
        )

    _emit_progress(callback_context, "Fixing validation errors...")
    logger.info("Coordinator: starting fixer agent")
    return None


def after_fixer(callback_context: CallbackContext) -> None:
    """Called after the fixer agent finishes."""
    _emit_progress(callback_context, "Fix pass complete. Re-validating...")
    logger.info("Coordinator: fixer agent finished")


# ---------------------------------------------------------------------------
# Wire up callbacks on each agent
# ---------------------------------------------------------------------------

planner_agent.before_agent_callback = before_planner
planner_agent.after_agent_callback = after_planner

code_generator_agent.before_agent_callback = before_generator
code_generator_agent.after_agent_callback = after_generator

# We need separate validator instances for the main pipeline and the fix loop
# because an agent can only appear once in the agent tree. Create a second
# validator for the fix loop.
from google.adk.agents import LlmAgent

from app.agents.tools import read_game_code, validate_phaser_config
from app.agents.validator import VALIDATOR_INSTRUCTION

fix_loop_validator = LlmAgent(
    name="fix_loop_validator",
    model=GEMINI_MODEL,
    instruction=VALIDATOR_INSTRUCTION,
    tools=[read_game_code, validate_phaser_config],
    output_key="validation_result",
)

# Attach callbacks to the main-pipeline validator
validator_agent.before_agent_callback = before_validator
validator_agent.after_agent_callback = after_validator

# Attach callbacks to the fix-loop validator
fix_loop_validator.before_agent_callback = before_validator
fix_loop_validator.after_agent_callback = after_validator

# Attach callbacks to fixer
fixer_agent.before_agent_callback = before_fixer
fixer_agent.after_agent_callback = after_fixer


# ---------------------------------------------------------------------------
# Build the agent pipeline
# ---------------------------------------------------------------------------

# Fix loop: fixer → validator, up to 3 iterations.
# If the fixer's before_callback detects validation passed, it short-circuits.
fix_loop = LoopAgent(
    name="fix_loop",
    sub_agents=[fixer_agent, fix_loop_validator],
    max_iterations=3,
)

# Full coordinator pipeline: plan → generate → validate → fix loop
coordinator_agent = SequentialAgent(
    name="coordinator",
    description=(
        "Orchestrates the full game generation pipeline: "
        "plan → generate → validate → fix loop."
    ),
    sub_agents=[planner_agent, code_generator_agent, validator_agent, fix_loop],
)

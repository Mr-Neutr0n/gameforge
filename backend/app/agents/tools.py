"""ADK tool functions for game generation agents.

Each function receives a ToolContext from the ADK framework, which provides
access to session state (tool_context.state) for reading and writing data
shared across agents in a pipeline.

These are stubs — full implementations come in TASK-017.
"""

import re

from google.adk.tools import ToolContext


def write_game_code(
    filename: str, content: str, tool_context: ToolContext
) -> dict:
    """Write or overwrite game code in the session state.

    Args:
        filename: Name of the file to write (e.g. "game.js").
        content: The full JavaScript source code.
        tool_context: ADK tool context with access to session state.

    Returns:
        Dict with status and filename.
    """
    files: dict = tool_context.state.get("game_files", {})
    files[filename] = content
    tool_context.state["game_files"] = files
    return {"status": "ok", "filename": filename, "size": len(content)}


def read_game_code(filename: str, tool_context: ToolContext) -> dict:
    """Read current game code from session state.

    Args:
        filename: Name of the file to read.
        tool_context: ADK tool context with access to session state.

    Returns:
        Dict with filename and content, or an error if not found.
    """
    files: dict = tool_context.state.get("game_files", {})
    if filename not in files:
        return {"status": "error", "message": f"File '{filename}' not found"}
    return {"status": "ok", "filename": filename, "content": files[filename]}


def list_game_files(tool_context: ToolContext) -> dict:
    """List all game files stored in session state.

    Args:
        tool_context: ADK tool context with access to session state.

    Returns:
        Dict with list of filenames.
    """
    files: dict = tool_context.state.get("game_files", {})
    return {"status": "ok", "files": list(files.keys())}


def get_game_plan(tool_context: ToolContext) -> dict:
    """Return the current game plan from session state.

    Args:
        tool_context: ADK tool context with access to session state.

    Returns:
        Dict with the game plan, or empty if not yet set.
    """
    plan = tool_context.state.get("game_plan", None)
    if plan is None:
        return {"status": "no_plan", "message": "No game plan set yet."}
    return {"status": "ok", "plan": plan}


def validate_phaser_config(code: str) -> dict:
    """Basic regex checks that Phaser.Game config exists and scenes are defined.

    Args:
        code: The Phaser.js JavaScript source code to validate.

    Returns:
        Dict with valid flag and list of errors found.
    """
    errors: list[str] = []

    if "new Phaser.Game" not in code and "Phaser.Game" not in code:
        errors.append("Missing Phaser.Game constructor")

    if not re.search(r"(preload|function\s+preload)", code):
        errors.append("Missing preload() method")

    if not re.search(r"(create|function\s+create)", code):
        errors.append("Missing create() method")

    if not re.search(r"(update|function\s+update)", code):
        errors.append("Missing update() method")

    scene_pattern = re.compile(
        r"(class\s+\w+\s+extends\s+Phaser\.Scene|scene\s*:\s*[\[\{])"
    )
    if not scene_pattern.search(code):
        errors.append("No Phaser.Scene subclass or scene config found")

    return {"valid": len(errors) == 0, "errors": errors}


def report_progress(message: str, tool_context: ToolContext) -> dict:
    """Store a progress message for streaming to the frontend.

    Args:
        message: Human-readable progress message.
        tool_context: ADK tool context with access to session state.

    Returns:
        Dict confirming the message was stored.
    """
    progress: list = tool_context.state.get("progress_messages", [])
    progress.append(message)
    tool_context.state["progress_messages"] = progress
    return {"status": "ok", "message": message}

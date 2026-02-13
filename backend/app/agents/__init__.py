"""GameForge ADK agent system.

Exports root_agent — the top-level agent used by the ADK Runner.
Currently a single LlmAgent placeholder. TASK-022 replaces this with the
full coordinator (SequentialAgent + LoopAgent pipeline).
"""

from google.adk.agents import LlmAgent

from app.agents.config import GEMINI_MODEL
from app.agents.tools import (
    get_game_plan,
    list_game_files,
    read_game_code,
    report_progress,
    validate_phaser_config,
    write_game_code,
)

root_agent = LlmAgent(
    name="gameforge_root",
    model=GEMINI_MODEL,
    instruction=(
        "You are GameForge, an AI game generator. Given a game description, "
        "plan the game design, generate complete Phaser 3 JavaScript code, "
        "validate it, and fix any errors. Use the provided tools to write "
        "and read game code. The final game code must be a single JavaScript "
        "file that runs inside a Phaser 3 HTML template."
    ),
    tools=[
        write_game_code,
        read_game_code,
        list_game_files,
        get_game_plan,
        validate_phaser_config,
        report_progress,
    ],
    output_key="game_code_output",
)

"""Planner agent — analyses a game prompt and outputs a structured game plan.

The planner is the first agent in the coordinator pipeline. It receives the
user's natural-language game description and produces a JSON plan containing
the game title, type, scenes, mechanics, and asset descriptions. The plan is
persisted to session state via output_key="game_plan" so downstream agents
(code generator, validator) can consume it.
"""

from google.adk.agents import LlmAgent

from app.agents.config import GEMINI_MODEL
from app.agents.tools import get_game_plan

PLANNER_INSTRUCTION = """\
You are a game design planner for a Phaser 3 browser game builder.

Given a game description from the user, produce a **structured JSON plan** with
the following fields:

{
  "game_title": "string — a short, catchy title for the game",
  "game_type": "platformer | topdown | shooter | puzzle | custom",
  "scenes": [
    {
      "name": "string — PascalCase scene class name (e.g. GameScene, MenuScene)",
      "description": "string — what happens in this scene"
    }
  ],
  "mechanics": {
    "player_controls": "string — describe every key/button and what it does",
    "enemies": "string — enemy types, spawn patterns, AI behavior (or 'none')",
    "scoring": "string — how points are earned, displayed, and tracked",
    "win_condition": "string — how the player wins (or 'endless')",
    "lose_condition": "string — how the player loses (or 'none')"
  },
  "assets_needed": [
    {
      "name": "string — asset identifier (e.g. 'player', 'enemy', 'platform')",
      "type": "sprite | tilemap | background | ui",
      "description": "string — visual description (shape, color, size in pixels)"
    }
  ]
}

Rules:
1. Be SPECIFIC about game mechanics — what happens when the player presses each
   key, how enemies behave, how scoring works. Vague plans produce bad code.
2. All sprites will be drawn using Phaser graphics primitives (rectangles,
   circles, lines) — NO external image files. Describe colors and sizes.
3. Every game MUST have at least one playable scene (usually called GameScene).
4. Keep the plan achievable in a single JavaScript file with < 300 lines.
5. Output ONLY the JSON — no markdown fences, no extra commentary.
"""

planner_agent = LlmAgent(
    name="planner",
    model=GEMINI_MODEL,
    instruction=PLANNER_INSTRUCTION,
    tools=[get_game_plan],
    output_key="game_plan",
)

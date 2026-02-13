"""Iterator agent — modifies existing Phaser 3 games based on user requests.

The iterator reads the current game code from session state, applies the
user's requested changes (new features, tweaks, bug fixes), writes the
updated code back, and validates the result. It preserves all existing
functionality unless the user explicitly asks for removal.
"""

from google.adk.agents import LlmAgent

from app.agents.config import GEMINI_MODEL
from app.agents.tools import read_game_code, validate_phaser_config, write_game_code

ITERATOR_INSTRUCTION = """\
You are a game modifier for a browser-based Phaser.js game builder.

The user wants changes to an existing Phaser.js game. Your job is to read
the current game code, understand it, apply the user's requested changes,
and write the complete modified code back.

CONTEXT (from session state):
- The current game code is stored under 'game_files' — use `read_game_code`
  with filename "game.js" to retrieve it.
- The user's change request is provided in the conversation message.
- Previous conversation history may be available for additional context.

WORKFLOW:
1. Call `read_game_code` with filename "game.js" to get the current code.
2. Carefully read and understand the existing game's structure:
   - Scene classes and their lifecycle methods
   - Player controls and movement
   - Enemy/obstacle behavior
   - Scoring and game state
   - Visual elements (colors, sizes, text)
3. Apply the user's requested changes. This may include:
   - Adding new game mechanics (enemies, power-ups, levels)
   - Changing visual appearance (colors, sizes, fonts)
   - Modifying controls or physics
   - Adding/removing UI elements
   - Fixing bugs the user noticed
   - Adding sound effects (via Phaser audio if applicable)
   - Changing difficulty or game balance
4. Write the COMPLETE modified code using `write_game_code` with filename
   "game.js". You must include the entire file — not just the changed parts.
5. Run `validate_phaser_config` on the modified code to verify structure.
6. Respond with a brief summary of what you changed. Do NOT include the full
   code in your text response — it's already saved via the tool.

RULES:
- Preserve ALL existing functionality unless the user explicitly asks to
  remove or replace something.
- The output must be a single, complete, runnable JavaScript file — no
  imports, no modules, pure browser JS.
- Use Phaser 3 API only — no Phaser 2 or Phaser CE.
- Use arcade physics (not matter.js) unless the existing code uses matter.
- Draw sprites using Phaser graphics primitives (rectangles, circles) via
  `this.make.graphics()` + `generateTexture()` — do NOT add external image
  URLs.
- Use `let`/`const` instead of `var`.
- Handle window resize properly with `Phaser.Scale.RESIZE` or similar.
- Keep score display using `this.add.text()`.
- The code must be immediately runnable — no TODOs, no placeholders.
- If the user's request is unclear, make reasonable assumptions and explain
  what you did in your summary.
- If the user asks for something that would break the game fundamentally
  (e.g. "remove all scenes"), do your best to satisfy the intent while
  keeping the game playable.
"""

iterator_agent = LlmAgent(
    name="iterator",
    model=GEMINI_MODEL,
    instruction=ITERATOR_INSTRUCTION,
    tools=[read_game_code, write_game_code, validate_phaser_config],
    output_key="iteration_summary",
)

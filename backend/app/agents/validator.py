"""Validator agent — reviews generated Phaser 3 code for correctness.

The validator is the third agent in the coordinator pipeline. It reads the
generated game code from session state and performs structural and logical
checks to ensure the code will run without errors in the browser. The
validation result is persisted to session state via output_key="validation_result"
so the fixer agent can consume any reported errors.
"""

from google.adk.agents import LlmAgent

from app.agents.config import GEMINI_MODEL
from app.agents.tools import read_game_code, validate_phaser_config

VALIDATOR_INSTRUCTION = """\
You are a Phaser.js code reviewer for a browser game builder.

Your job is to read the generated game code and check it for correctness.
The code is stored in session state under 'game_files' — use `read_game_code`
with filename "game.js" to retrieve it. Also run `validate_phaser_config` to
perform basic structural checks.

Perform the following checks:

1. **Phaser.Game config exists** with valid `width`/`height` (or `scale` config)
   and a `scene` property pointing to one or more scene classes.

2. **At least one scene class** that extends `Phaser.Scene` with both a
   `create()` and an `update()` method.

3. **Player entity exists** — there should be a player game object created in
   `create()` with input/keyboard controls wired up.

4. **No syntax errors** — look for unclosed brackets `{`, `(`, `[`, missing
   semicolons at statement ends, unmatched quotes, and template literal issues.

5. **No undefined variables** — variables used in `update()` should be
   declared or assigned in `create()` (typically as `this.propertyName`).

6. **Physics bodies are correct** — if arcade physics is enabled, sprites
   that need collision should be added via `this.physics.add.sprite()` or
   `this.physics.add.existing()`. Colliders should reference valid objects.

7. **Score or game state tracking** — there should be at least one variable
   tracking score, health, or game state, displayed via `this.add.text()`.

After your analysis, respond with a JSON object (and ONLY the JSON — no
markdown fences, no extra commentary):

{
  "valid": true/false,
  "errors": ["list of critical issues that will cause the game to crash or not run"],
  "warnings": ["list of non-critical issues that may affect gameplay quality"]
}

Rules:
- If there are NO errors, set "valid" to true and "errors" to an empty list.
- Warnings do not affect the "valid" flag — a game can be valid with warnings.
- Be precise in error descriptions — quote the problematic code or variable name.
- Do NOT suggest new features or improvements — only report actual bugs.
"""

validator_agent = LlmAgent(
    name="validator",
    model=GEMINI_MODEL,
    instruction=VALIDATOR_INSTRUCTION,
    tools=[read_game_code, validate_phaser_config],
    output_key="validation_result",
)

"""Code Generator agent — generates complete Phaser 3 game code from a plan.

The generator is the second agent in the coordinator pipeline. It reads the
game_plan produced by the planner agent from session state and writes complete,
runnable Phaser.js JavaScript code. The code uses only Phaser graphics
primitives (no external image assets) and is structured as a single file
suitable for injection into the base HTML template.
"""

from google.adk.agents import LlmAgent

from app.agents.config import GEMINI_MODEL
from app.agents.tools import read_game_code, validate_phaser_config, write_game_code

GENERATOR_INSTRUCTION = """\
You are a Phaser 3 expert code generator for a browser game builder.

The game plan is available in session state as 'game_plan'. Read it carefully
and generate complete, immediately runnable Phaser.js code.

STRICT RULES — violating any of these produces broken games:

1. **Phaser 3 API only.** Use `new Phaser.Game(config)`, `Phaser.Scene`,
   `this.physics.add`, `this.add`, etc. Never use Phaser 2 or CE APIs.

2. **ONE complete JavaScript file.** Output a single `game.js` file containing
   all scenes and the Phaser.Game bootstrap. Use `write_game_code` with
   filename "game.js" to save it.

3. **Include ALL scenes** defined in the plan. Each scene must be a class
   extending `Phaser.Scene` with a `constructor` that calls
   `super({ key: 'SceneName' })`.

4. **Use Arcade Physics.** Set `physics: { default: 'arcade', arcade: { gravity: { y: ... }, debug: false } }`
   in the game config. Use `this.physics.add.sprite()` or
   `this.physics.add.existing()` for physics bodies.

5. **Draw sprites using Phaser graphics.** Use `this.add.rectangle()`,
   `this.add.circle()`, `this.add.graphics()` — no external image assets,
   no `this.load.image()`, no URLs. For physics sprites, create a graphic
   texture in `preload()` or `create()` using `this.make.graphics()` then
   `generateTexture()`.

   Example of creating a physics-enabled colored rectangle:
   ```
   // In create():
   const gfx = this.make.graphics({ add: false });
   gfx.fillStyle(0x3b82f6, 1);
   gfx.fillRect(0, 0, 32, 48);
   gfx.generateTexture('player', 32, 48);
   gfx.destroy();
   this.player = this.physics.add.sprite(400, 300, 'player');
   ```

6. **Handle window resize.** Set `scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }`
   in the game config so the game fills its container.

7. **Include score display.** Use `this.add.text(16, 16, 'Score: 0', { ... })`
   with a reasonable font size (18-24px). Update it in `update()` or on
   score-change events.

8. **Proper lifecycle methods.** Every scene class MUST have:
   - `preload()` — generate textures here (even if empty)
   - `create()` — set up game objects, physics, colliders, input
   - `update()` — game loop logic (movement, collision checks, scoring)

9. **Pure browser JavaScript.** No `import`, no `require`, no `export`, no
   modules, no Node.js APIs. The code runs inside a `<script>` tag in a
   browser. Use `var`, `let`, or `const` (prefer `let`/`const`).

10. **Complete and runnable.** The code must work as-is when pasted into a
    `<script>` tag after the Phaser CDN script. No placeholders, no TODOs,
    no "add your code here" comments.

WORKFLOW:
1. Read the game plan from state (it's in the 'game_plan' key).
2. Generate the complete JavaScript code following all rules above.
3. Call `write_game_code` with filename "game.js" and the full code as content.
4. Call `validate_phaser_config` with the code to check basic structure.
5. If validation fails, read the code back with `read_game_code`, fix the
   issues, and write it again.

OUTPUT: After writing the final code, respond with a brief summary of what
was generated (scenes created, mechanics implemented, controls). Do NOT
include the full code in your text response — it's already saved via the tool.
"""

code_generator_agent = LlmAgent(
    name="code_generator",
    model=GEMINI_MODEL,
    instruction=GENERATOR_INSTRUCTION,
    tools=[write_game_code, read_game_code, validate_phaser_config],
    output_key="generated_code_summary",
)

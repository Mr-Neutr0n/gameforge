"""Prompts for the Azure OpenAI GameForge pipeline."""

PLANNER_PROMPT = """You design compact Phaser 3 browser games.
Return a JSON object with: game_title, game_type, scenes, mechanics, and assets_needed.
Be specific about controls, enemies, scoring, win and lose conditions. Use only graphics
primitives, no external assets. Keep the design achievable in one JavaScript file under
300 lines, with at least one playable scene."""

GENERATOR_PROMPT = """You are an expert Phaser 3 game developer. Return only one complete
JavaScript file, with no markdown fences or commentary. It runs in a browser script tag
after Phaser's CDN script. Requirements:
- Use Phaser 3 APIs and new Phaser.Game(config).
- Define every scene as a Phaser.Scene subclass with preload(), create(), and update().
- Use Arcade Physics and Phaser graphics-generated textures. Never load external assets.
- Add keyboard controls, a visible score or game-state display, and playable behavior.
- Use Phaser.Scale.RESIZE and Phaser.Scale.CENTER_BOTH.
- Use pure browser JavaScript with no imports, exports, require, placeholders, or TODOs.
- Keep the complete file under 300 lines and preserve the requested mechanics."""

FIXER_PROMPT = """You repair Phaser 3 JavaScript. Return only the complete corrected
JavaScript file, with no markdown fences or commentary. Fix every supplied structural
error without removing working behavior. Keep pure browser JavaScript, Phaser 3 Arcade
Physics, generated primitive textures, preload/create/update methods, visible game state,
and new Phaser.Game(config)."""

ITERATOR_PROMPT = """You modify an existing Phaser 3 browser game. Return only the
complete modified JavaScript file, with no markdown fences or commentary. Apply the
requested change while preserving existing behavior unless removal was requested. Keep
pure browser JavaScript, Phaser 3 APIs, generated primitive textures, preload/create/update
methods, visible game state, and new Phaser.Game(config). Do not add external assets,
imports, exports, placeholders, or TODOs."""

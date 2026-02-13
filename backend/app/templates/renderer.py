"""Phaser.js game template renderer.

Loads the base HTML template and injects generated game code into it,
producing a self-contained HTML file that can be served in an iframe.
"""

from pathlib import Path

_TEMPLATE_DIR = Path(__file__).parent
_BASE_TEMPLATE_PATH = _TEMPLATE_DIR / "base.html"
_PLACEHOLDER = "{{GAME_CODE}}"

# Cache the template content in memory after first read
_cached_template: str | None = None


def _load_template() -> str:
    """Load and cache the base HTML template from disk."""
    global _cached_template
    if _cached_template is None:
        _cached_template = _BASE_TEMPLATE_PATH.read_text(encoding="utf-8")
    return _cached_template


def render_game_html(game_code: str) -> str:
    """Inject game code into the Phaser.js base template.

    Args:
        game_code: The generated Phaser.js JavaScript code to embed.

    Returns:
        A complete HTML string ready to be served in an iframe.

    Raises:
        ValueError: If game_code is empty or only whitespace.
    """
    if not game_code or not game_code.strip():
        raise ValueError("game_code must not be empty")

    template = _load_template()
    return template.replace(_PLACEHOLDER, game_code)

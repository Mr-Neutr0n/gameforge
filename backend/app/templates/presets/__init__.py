"""Phaser.js game template presets.

Provides ready-to-play skeleton games that the AI agent can use
as starting points when generating games from user prompts.
"""

from pathlib import Path

_PRESETS_DIR = Path(__file__).parent

AVAILABLE_PRESETS = ("platformer", "topdown", "shooter", "puzzle")


def load_preset(name: str) -> str:
    """Load a preset game template by name.

    Args:
        name: One of 'platformer', 'topdown', 'shooter', 'puzzle'.

    Returns:
        The JavaScript source code for the preset game.

    Raises:
        ValueError: If the preset name is not recognized.
        FileNotFoundError: If the preset file is missing on disk.
    """
    if name not in AVAILABLE_PRESETS:
        raise ValueError(
            f"Unknown preset '{name}'. Available: {', '.join(AVAILABLE_PRESETS)}"
        )

    preset_path = _PRESETS_DIR / f"{name}.js"
    return preset_path.read_text(encoding="utf-8")


def list_presets() -> list[dict[str, str]]:
    """Return metadata for all available presets."""
    descriptions = {
        "platformer": "Side-scrolling platformer with gravity, platforms, coins, enemies, and arrow-key controls.",
        "topdown": "Top-down adventure with 4-directional WASD movement, tile map, gems, and patrolling enemies.",
        "shooter": "Vertical space shooter with player ship, enemy waves, spacebar shooting, and score tracking.",
        "puzzle": "Grid-based match puzzle — click groups of 3+ same-colored tiles to clear them.",
    }
    return [
        {"name": name, "description": descriptions[name]}
        for name in AVAILABLE_PRESETS
    ]

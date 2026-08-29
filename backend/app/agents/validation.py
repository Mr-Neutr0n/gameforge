"""Local structural checks for generated Phaser code."""

import re


_CODE_FENCE = re.compile(r"```(?:javascript|js)?\s*(.*?)```", re.IGNORECASE | re.DOTALL)


def clean_code(value: str) -> str:
    """Remove markdown fencing while preserving the complete JavaScript payload."""
    match = _CODE_FENCE.search(value)
    code = match.group(1) if match else value
    return code.strip()


def validate_phaser_code(code: str) -> dict:
    errors: list[str] = []
    if not re.search(r"Phaser\s*\.\s*Game", code):
        errors.append("Missing Phaser.Game constructor")

    method_patterns = {
        name: [
            rf"\b{name}\s*\([^)]*\)\s*\{{",
            rf"{name}\s*:\s*function\s*\(",
            rf"{name}\s*:\s*\([^)]*\)\s*=>",
            rf"{name}\s*:\s*\w+\s*=>",
        ]
        for name in ("preload", "create", "update")
    }
    for method, patterns in method_patterns.items():
        if not any(re.search(pattern, code) for pattern in patterns):
            errors.append(f"Missing {method}() method")

    scene_patterns = [
        r"class\s+\w+\s+extends\s+Phaser\s*\.\s*Scene",
        r"scene\s*:\s*[\[\{]",
        r"scene\s*:\s*\w+",
    ]
    if not any(re.search(pattern, code) for pattern in scene_patterns):
        errors.append("No Phaser.Scene subclass or scene config found")
    if re.search(r"\b(?:import|export)\s", code) or "require(" in code:
        errors.append("Browser game must not use modules")
    if re.search(r"\bthis\.load\.(?:image|spritesheet|audio)\s*\(", code):
        errors.append("External assets are not allowed")
    if len(code) > 80_000:
        errors.append("Generated code exceeds the size limit")
    return {"valid": not errors, "errors": errors, "warnings": []}


# Compatibility name for older internal callers.
validate_phaser_config = validate_phaser_code

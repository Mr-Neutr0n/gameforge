"""Logic audit for generated Phaser.js game code.

Performs automated checks on game code using string analysis and regex
to verify structural correctness and playability fundamentals.
"""

import re


def _check_phaser_game_exists(code: str) -> dict:
    """Check that `new Phaser.Game` constructor is present."""
    found = bool(re.search(r"new\s+Phaser\.Game\s*\(", code))
    return {
        "check": "phaser_game_constructor",
        "passed": found,
        "message": (
            "Phaser.Game constructor found"
            if found
            else "Missing `new Phaser.Game(...)` constructor"
        ),
    }


def _check_scene_exists(code: str) -> dict:
    """Check for at least one Phaser.Scene subclass or scene config object."""
    # Match class extends Phaser.Scene
    class_scene = bool(
        re.search(r"class\s+\w+\s+extends\s+Phaser\.Scene", code)
    )
    # Match scene config objects: { key: '...', create: function ... }
    config_scene = bool(
        re.search(
            r"\{\s*key\s*:\s*['\"][\w]+['\"].*?create\s*[:(]",
            code,
            re.DOTALL,
        )
    )
    found = class_scene or config_scene
    return {
        "check": "scene_definition",
        "passed": found,
        "message": (
            "Scene definition found"
            if found
            else "No Phaser.Scene subclass or scene config object found"
        ),
    }


def _check_create_method(code: str) -> dict:
    """Check that a create() method exists."""
    # Match create() as a class method or as a function property
    found = bool(
        re.search(r"\bcreate\s*\(\s*\)\s*\{", code)
        or re.search(r"create\s*:\s*function\s*\(", code)
    )
    return {
        "check": "create_method",
        "passed": found,
        "message": (
            "create() method found"
            if found
            else "Missing create() lifecycle method"
        ),
    }


def _check_update_method(code: str) -> dict:
    """Check that an update() method exists."""
    found = bool(
        re.search(r"\bupdate\s*\([^)]*\)\s*\{", code)
        or re.search(r"update\s*:\s*function\s*\(", code)
    )
    return {
        "check": "update_method",
        "passed": found,
        "message": (
            "update() method found"
            if found
            else "Missing update() lifecycle method"
        ),
    }


def _check_player_entity(code: str) -> dict:
    """Check that a player entity is created in the code."""
    # Look for common player variable patterns
    patterns = [
        r"this\.player\s*=",
        r"this\.add\.\w+\s*\(",  # this.add.sprite(, this.add.rectangle(, etc.
        r"this\.physics\.add\.\w+\s*\(",
        r"player\s*=\s*this\.\w+\.add",
        r"let\s+player\s*=",
        r"const\s+player\s*=",
        r"var\s+player\s*=",
    ]
    found = any(re.search(p, code) for p in patterns)
    return {
        "check": "player_entity",
        "passed": found,
        "message": (
            "Player entity creation found"
            if found
            else "No player entity creation detected (expected this.player = ... or similar)"
        ),
    }


def _check_input_handling(code: str) -> dict:
    """Check that keyboard or pointer input handling exists."""
    patterns = [
        r"this\.input\.keyboard",
        r"this\.cursors",
        r"cursors\s*=",
        r"this\.input\.on\s*\(",
        r"this\.input\.activePointer",
        r"Phaser\.Input\.Keyboard",
        r"createCursorKeys",
        r"addKey\s*\(",
        r"this\.input\.mouse",
        r"keyboard\.addKeys\s*\(",
        r"on\s*\(\s*['\"]pointerdown['\"]",
        r"on\s*\(\s*['\"]pointerup['\"]",
        r"wasd",
        r"WASD",
    ]
    found = any(re.search(p, code) for p in patterns)
    return {
        "check": "input_handling",
        "passed": found,
        "message": (
            "Input handling found"
            if found
            else "No keyboard or pointer input handling detected"
        ),
    }


def _check_no_infinite_loops(code: str) -> dict:
    """Check that no while(true) without break exists."""
    # Find while(true) or while(1) patterns
    infinite_loop_pattern = re.compile(
        r"while\s*\(\s*(true|1)\s*\)\s*\{([^}]*)\}", re.DOTALL
    )
    matches = infinite_loop_pattern.findall(code)
    has_dangerous_loop = False
    for _, body in matches:
        if "break" not in body and "return" not in body:
            has_dangerous_loop = True
            break

    passed = not has_dangerous_loop
    return {
        "check": "no_infinite_loops",
        "passed": passed,
        "message": (
            "No dangerous infinite loops detected"
            if passed
            else "Found while(true) loop without break/return — potential infinite loop"
        ),
    }


def _check_score_or_state(code: str) -> dict:
    """Check for a score or game state variable."""
    patterns = [
        r"score\s*[=:]",
        r"this\.score\s*=",
        r"gameOver",
        r"this\.gameOver",
        r"isGameOver",
        r"state\s*[=:]",
        r"this\.state\s*=",
        r"lives\s*[=:]",
        r"this\.lives\s*=",
        r"health\s*[=:]",
        r"this\.health\s*=",
        r"level\s*[=:]",
        r"this\.level\s*=",
        r"scoreText",
        r"this\.scoreText",
    ]
    found = any(re.search(p, code) for p in patterns)
    return {
        "check": "score_or_state",
        "passed": found,
        "message": (
            "Score or game state tracking found"
            if found
            else "No score, lives, health, or game state variable detected"
        ),
    }


# ── Public API ──────────────────────────────────────────────────────────


def run_logic_audit(game_code: str) -> dict:
    """Run all logic audit checks on the given game code.

    Args:
        game_code: The Phaser.js game source code as a string.

    Returns:
        A dict with keys: passed (bool), score (int 0-100), details (list of check results).
    """
    if not game_code or not game_code.strip():
        return {
            "passed": False,
            "score": 0,
            "details": [
                {
                    "check": "empty_code",
                    "passed": False,
                    "message": "Game code is empty",
                }
            ],
        }

    checks = [
        _check_phaser_game_exists,
        _check_scene_exists,
        _check_create_method,
        _check_update_method,
        _check_player_entity,
        _check_input_handling,
        _check_no_infinite_loops,
        _check_score_or_state,
    ]

    details = [check(game_code) for check in checks]
    passed_count = sum(1 for d in details if d["passed"])
    total = len(details)

    score = int((passed_count / total) * 100) if total > 0 else 0
    all_passed = passed_count == total

    return {
        "passed": all_passed,
        "score": score,
        "details": details,
    }

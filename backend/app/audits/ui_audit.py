"""UI audit for generated Phaser.js game code.

Performs automated checks on game code to verify visual/UI correctness:
canvas dimensions, background color, font sizes, viewport fit, and
default UI element positioning.
"""

import re


def _check_valid_dimensions(code: str) -> dict:
    """Check that Phaser.Game config has valid width/height (> 0, < 4096)."""
    # Match width and height in the Phaser.Game config object
    width_match = re.search(
        r"width\s*:\s*(\d+)", code
    )
    height_match = re.search(
        r"height\s*:\s*(\d+)", code
    )

    if not width_match or not height_match:
        # Also check for window.innerWidth / window.innerHeight patterns
        dynamic_width = bool(re.search(r"width\s*:\s*window\.innerWidth", code))
        dynamic_height = bool(re.search(r"height\s*:\s*window\.innerHeight", code))
        if dynamic_width and dynamic_height:
            return {
                "check": "valid_dimensions",
                "passed": True,
                "message": "Game uses dynamic window dimensions",
            }
        if dynamic_width or dynamic_height:
            return {
                "check": "valid_dimensions",
                "passed": True,
                "message": "Game uses at least one dynamic dimension",
            }
        return {
            "check": "valid_dimensions",
            "passed": False,
            "message": "Could not find width/height in Phaser.Game config",
        }

    width = int(width_match.group(1))
    height = int(height_match.group(1))

    valid = 0 < width < 4096 and 0 < height < 4096
    if valid:
        msg = f"Game dimensions {width}x{height} are valid"
    else:
        issues = []
        if width <= 0 or width >= 4096:
            issues.append(f"width={width} out of range (1-4095)")
        if height <= 0 or height >= 4096:
            issues.append(f"height={height} out of range (1-4095)")
        msg = "Invalid game dimensions: " + ", ".join(issues)

    return {
        "check": "valid_dimensions",
        "passed": valid,
        "message": msg,
    }


def _check_background_color(code: str) -> dict:
    """Check that a canvas background color is set (not default black)."""
    patterns = [
        # backgroundColor in Phaser.Game config
        r"backgroundColor\s*:\s*['\"]#?[0-9a-fA-F]+['\"]",
        r"backgroundColor\s*:\s*0x[0-9a-fA-F]+",
        # Setting background color via camera
        r"this\.cameras\.main\.setBackgroundColor\s*\(",
        r"cameras\.main\.backgroundColor",
        # Setting via scene config
        r"backgroundColor\s*:\s*['\"][\w#]+['\"]",
    ]
    found = any(re.search(p, code) for p in patterns)
    return {
        "check": "background_color",
        "passed": found,
        "message": (
            "Background color is explicitly set"
            if found
            else "No background color set — game will default to black"
        ),
    }


def _check_text_font_sizes(code: str) -> dict:
    """Check that text objects use reasonable font sizes (12-72)."""
    # Match fontSize in Phaser text style objects: fontSize: '24px', fontSize: "32px"
    font_size_matches = re.findall(
        r"fontSize\s*:\s*['\"](\d+)(?:px)?['\"]", code
    )
    # Also match setFontSize calls
    set_font_matches = re.findall(
        r"setFontSize\s*\(\s*(\d+)\s*\)", code
    )
    # Also match font shorthand: font: '24px Arial'
    font_shorthand_matches = re.findall(
        r"font\s*:\s*['\"](\d+)px\s+\w+", code
    )

    all_sizes = [int(s) for s in font_size_matches + set_font_matches + font_shorthand_matches]

    if not all_sizes:
        # No text with explicit font sizes found — might use defaults, which is OK
        # but not ideal. Check if text objects exist at all.
        has_text = bool(
            re.search(r"this\.add\.text\s*\(", code)
            or re.search(r"this\.make\.text\s*\(", code)
        )
        if has_text:
            return {
                "check": "text_font_sizes",
                "passed": True,
                "message": "Text objects found using default font sizes (acceptable)",
            }
        return {
            "check": "text_font_sizes",
            "passed": True,
            "message": "No text objects found — font size check not applicable",
        }

    bad_sizes = [s for s in all_sizes if s < 12 or s > 72]
    if bad_sizes:
        return {
            "check": "text_font_sizes",
            "passed": False,
            "message": (
                f"Font sizes outside recommended range (12-72): {bad_sizes}"
            ),
        }
    return {
        "check": "text_font_sizes",
        "passed": True,
        "message": f"All font sizes are within recommended range: {all_sizes}",
    }


def _check_viewport_fit(code: str) -> dict:
    """Check that game area fits within common viewport sizes."""
    width_match = re.search(r"width\s*:\s*(\d+)", code)
    height_match = re.search(r"height\s*:\s*(\d+)", code)

    # Dynamic sizing is always fine
    if re.search(r"width\s*:\s*window\.innerWidth", code):
        return {
            "check": "viewport_fit",
            "passed": True,
            "message": "Game uses dynamic viewport sizing",
        }

    if not width_match or not height_match:
        return {
            "check": "viewport_fit",
            "passed": True,
            "message": "Cannot determine fixed dimensions — skipping viewport fit check",
        }

    width = int(width_match.group(1))
    height = int(height_match.group(1))

    # Common viewport: 1920x1080 desktop, but game should also work on
    # typical laptop (1366x768) and embedded iframe (likely ~800x600 area)
    # We warn if the game is larger than 1920x1080
    fits = width <= 1920 and height <= 1080
    return {
        "check": "viewport_fit",
        "passed": fits,
        "message": (
            f"Game dimensions {width}x{height} fit within standard viewports"
            if fits
            else f"Game dimensions {width}x{height} exceed standard viewport (1920x1080)"
        ),
    }


def _check_no_overlapping_ui(code: str) -> dict:
    """Check for potential overlapping UI elements in default positions.

    Detects multiple UI elements placed at the same default position (e.g. 0,0
    or 10,10) which could cause visual overlap.
    """
    # Find all this.add.text( x, y, ... ) calls — capture x and y
    text_positions = re.findall(
        r"this\.add\.text\s*\(\s*(\d+)\s*,\s*(\d+)", code
    )
    # Find this.add.image, this.add.sprite at fixed positions
    sprite_positions = re.findall(
        r"this\.add\.(?:image|sprite)\s*\(\s*(\d+)\s*,\s*(\d+)", code
    )

    ui_positions = [(int(x), int(y)) for x, y in text_positions + sprite_positions]

    if len(ui_positions) < 2:
        return {
            "check": "no_overlapping_ui",
            "passed": True,
            "message": "Fewer than 2 fixed-position UI elements — no overlap risk",
        }

    # Check for exact duplicates in positions (potential overlaps)
    seen = {}
    overlaps = []
    for pos in ui_positions:
        if pos in seen:
            seen[pos] += 1
        else:
            seen[pos] = 1

    for pos, count in seen.items():
        if count > 1:
            overlaps.append(f"({pos[0]}, {pos[1]}) used {count} times")

    if overlaps:
        return {
            "check": "no_overlapping_ui",
            "passed": False,
            "message": f"Potential UI element overlaps at: {'; '.join(overlaps)}",
        }

    return {
        "check": "no_overlapping_ui",
        "passed": True,
        "message": "No overlapping UI element positions detected",
    }


# ── Public API ──────────────────────────────────────────────────────────


def run_ui_audit(game_code: str) -> dict:
    """Run all UI audit checks on the given game code.

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
        _check_valid_dimensions,
        _check_background_color,
        _check_text_font_sizes,
        _check_viewport_fit,
        _check_no_overlapping_ui,
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

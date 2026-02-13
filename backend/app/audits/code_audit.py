"""Code quality audit for generated Phaser.js game code.

Performs automated checks on game code to verify code quality and security:
no eval/Function, no var declarations, scene cleanup, no direct DOM access
outside Phaser, no navigation calls, no external network requests, and
proper `this.` usage in scene methods.
"""

import re


def _check_no_eval(code: str) -> dict:
    """Check that code does not use eval() or Function() constructor."""
    # Match eval(...) calls
    has_eval = bool(re.search(r"\beval\s*\(", code))
    # Match new Function(...) constructor
    has_function_ctor = bool(re.search(r"\bnew\s+Function\s*\(", code))

    issues = []
    if has_eval:
        issues.append("eval() usage detected")
    if has_function_ctor:
        issues.append("new Function() constructor detected")

    passed = not issues
    return {
        "check": "no_eval_or_function",
        "passed": passed,
        "message": (
            "No eval() or Function() constructor found"
            if passed
            else "Unsafe code execution: " + "; ".join(issues)
        ),
    }


def _check_no_var_declarations(code: str) -> dict:
    """Check that code uses let/const instead of var."""
    # Match `var ` declarations — word boundary before, space after
    var_matches = re.findall(r"\bvar\s+(\w+)", code)

    if var_matches:
        # Show up to 5 variable names for context
        sample = var_matches[:5]
        extra = f" (and {len(var_matches) - 5} more)" if len(var_matches) > 5 else ""
        return {
            "check": "no_var_declarations",
            "passed": False,
            "message": (
                f"Found {len(var_matches)} var declaration(s) — "
                f"use let/const instead: {', '.join(sample)}{extra}"
            ),
        }
    return {
        "check": "no_var_declarations",
        "passed": True,
        "message": "No var declarations found — code uses let/const",
    }


def _check_scene_cleanup(code: str) -> dict:
    """Check that Phaser scenes have destroy() or shutdown cleanup logic."""
    # Find scene classes
    scene_classes = re.findall(
        r"class\s+(\w+)\s+extends\s+Phaser\.Scene", code
    )

    if not scene_classes:
        # No class-based scenes — check for scene config objects
        has_scene_config = bool(
            re.search(
                r"\{\s*key\s*:\s*['\"][\w]+['\"]",
                code,
            )
        )
        if not has_scene_config:
            return {
                "check": "scene_cleanup",
                "passed": True,
                "message": "No scene definitions found — cleanup check not applicable",
            }
        # Scene configs don't typically have destroy — pass with note
        return {
            "check": "scene_cleanup",
            "passed": True,
            "message": "Scene config objects detected — cleanup handled by Phaser lifecycle",
        }

    # Check for destroy(), shutdown(), or scene event listeners for cleanup
    cleanup_patterns = [
        r"\bdestroy\s*\(\s*\)\s*\{",
        r"\bshutdown\s*\(\s*\)\s*\{",
        r"this\.events\.on\s*\(\s*['\"]shutdown['\"]",
        r"this\.events\.on\s*\(\s*['\"]destroy['\"]",
        r"this\.events\.once\s*\(\s*['\"]shutdown['\"]",
        r"this\.sys\.events\.on\s*\(\s*['\"]shutdown['\"]",
    ]
    has_cleanup = any(re.search(p, code) for p in cleanup_patterns)

    if has_cleanup:
        return {
            "check": "scene_cleanup",
            "passed": True,
            "message": "Scene cleanup/destroy logic found",
        }

    return {
        "check": "scene_cleanup",
        "passed": False,
        "message": (
            f"Scene(s) {', '.join(scene_classes)} lack destroy()/shutdown cleanup — "
            "may cause memory leaks on scene transitions"
        ),
    }


def _check_no_direct_dom_access(code: str) -> dict:
    """Check that code does not use document.* calls outside Phaser API."""
    # Patterns for direct DOM access that shouldn't appear in Phaser code
    # Exclude document.addEventListener('DOMContentLoaded', ...) which is OK
    dom_patterns = [
        (r"document\.getElementById\s*\(", "document.getElementById()"),
        (r"document\.querySelector\s*\(", "document.querySelector()"),
        (r"document\.querySelectorAll\s*\(", "document.querySelectorAll()"),
        (r"document\.createElement\s*\(", "document.createElement()"),
        (r"document\.body\.", "document.body access"),
        (r"document\.write\s*\(", "document.write()"),
        (r"document\.cookie", "document.cookie access"),
        (r"\.innerHTML\s*=", "innerHTML assignment"),
        (r"\.outerHTML\s*=", "outerHTML assignment"),
    ]

    found_issues = []
    for pattern, label in dom_patterns:
        if re.search(pattern, code):
            found_issues.append(label)

    passed = not found_issues
    return {
        "check": "no_direct_dom_access",
        "passed": passed,
        "message": (
            "No direct DOM access outside Phaser API"
            if passed
            else "Direct DOM access detected: " + "; ".join(found_issues)
        ),
    }


def _check_no_navigation_calls(code: str) -> dict:
    """Check that code does not use window.location or navigation calls."""
    nav_patterns = [
        (r"window\.location\s*[=.]", "window.location modification"),
        (r"location\.href\s*=", "location.href assignment"),
        (r"location\.replace\s*\(", "location.replace()"),
        (r"location\.assign\s*\(", "location.assign()"),
        (r"window\.open\s*\(", "window.open()"),
        (r"window\.close\s*\(", "window.close()"),
        (r"history\.pushState\s*\(", "history.pushState()"),
        (r"history\.replaceState\s*\(", "history.replaceState()"),
        (r"history\.back\s*\(", "history.back()"),
        (r"history\.go\s*\(", "history.go()"),
    ]

    found_issues = []
    for pattern, label in nav_patterns:
        if re.search(pattern, code):
            found_issues.append(label)

    passed = not found_issues
    return {
        "check": "no_navigation_calls",
        "passed": passed,
        "message": (
            "No navigation or window.location calls found"
            if passed
            else "Navigation calls detected: " + "; ".join(found_issues)
        ),
    }


def _check_no_external_requests(code: str) -> dict:
    """Check that code does not make external fetch/XHR calls."""
    request_patterns = [
        (r"\bfetch\s*\(", "fetch() call"),
        (r"new\s+XMLHttpRequest\s*\(", "XMLHttpRequest usage"),
        (r"\.ajax\s*\(", "jQuery ajax call"),
        (r"new\s+WebSocket\s*\(", "WebSocket connection"),
        (r"new\s+EventSource\s*\(", "EventSource/SSE connection"),
        (r"navigator\.sendBeacon\s*\(", "sendBeacon() call"),
    ]

    found_issues = []
    for pattern, label in request_patterns:
        if re.search(pattern, code):
            found_issues.append(label)

    passed = not found_issues
    return {
        "check": "no_external_requests",
        "passed": passed,
        "message": (
            "No external network requests found"
            if passed
            else "External requests detected: " + "; ".join(found_issues)
        ),
    }


def _check_proper_this_usage(code: str) -> dict:
    """Check for proper use of `this.` in scene methods.

    Looks for common mistakes where scene properties are accessed without
    `this.` inside class methods (e.g., `player.x` instead of `this.player.x`
    when player is a scene property).
    """
    # Find properties assigned with `this.` in create()
    this_props = set(re.findall(r"this\.(\w+)\s*=", code))

    if not this_props:
        return {
            "check": "proper_this_usage",
            "passed": True,
            "message": "No this.property assignments found — check not applicable",
        }

    # Filter out Phaser built-in properties that are commonly accessed
    # without issues (they exist on the scene base class)
    builtins = {
        "add", "physics", "input", "cameras", "scene", "anims",
        "cache", "children", "data", "events", "game", "load",
        "make", "matter", "plugins", "registry", "renderer",
        "scale", "sound", "sys", "textures", "time", "tweens",
    }
    user_props = this_props - builtins

    if not user_props:
        return {
            "check": "proper_this_usage",
            "passed": True,
            "message": "Scene properties use proper this. references",
        }

    # Inside update() or create() bodies, look for bare access to these
    # properties that should be this.property. We check if a user prop
    # name appears as a standalone identifier (not preceded by `this.` or `.`)
    # in what looks like an assignment or method call context.
    suspicious = []
    for prop in user_props:
        # Look for patterns like: prop.x, prop.setX(), prop = ...
        # that are NOT preceded by this. or a dot
        # This is a heuristic — we look for `\bprop\b` not preceded by `this\.`
        pattern = rf"(?<!this\.)(?<!\.)(?<!\w)\b{re.escape(prop)}\b(?:\s*\.\s*\w+|\s*=)"
        matches = re.findall(pattern, code)
        if matches:
            # Verify it's not a local variable declaration (let/const prop = ...)
            local_decl = re.search(
                rf"\b(?:let|const|var)\s+{re.escape(prop)}\b", code
            )
            if not local_decl:
                suspicious.append(prop)

    if suspicious:
        return {
            "check": "proper_this_usage",
            "passed": False,
            "message": (
                f"Possible missing this. prefix for scene properties: "
                f"{', '.join(sorted(suspicious))} — "
                "these are assigned as this.{prop} but accessed without this."
            ),
        }

    return {
        "check": "proper_this_usage",
        "passed": True,
        "message": "Scene properties use proper this. references",
    }


# ── Public API ──────────────────────────────────────────────────────────


def run_code_audit(game_code: str) -> dict:
    """Run all code quality audit checks on the given game code.

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
        _check_no_eval,
        _check_no_var_declarations,
        _check_scene_cleanup,
        _check_no_direct_dom_access,
        _check_no_navigation_calls,
        _check_no_external_requests,
        _check_proper_this_usage,
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

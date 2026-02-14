"""Unit tests for audit modules: logic_audit, ui_audit, and code_audit.

Covers the test cases specified in TASK-012:
  - logic_audit: valid platformer (pass), empty string (fail gracefully),
    code missing Phaser.Game (fail)
  - ui_audit: valid config (pass), missing width/height, oversized dimensions
  - code_audit: clean code (pass), code using eval() (fail), code using var (flag)
"""

import pytest

from app.audits.logic_audit import (
    run_logic_audit,
    _check_phaser_game_exists,
    _check_scene_exists,
    _check_create_method,
    _check_update_method,
    _check_player_entity,
    _check_input_handling,
    _check_no_infinite_loops,
    _check_score_or_state,
)
from app.audits.ui_audit import (
    run_ui_audit,
    _check_valid_dimensions,
    _check_background_color,
    _check_text_font_sizes,
    _check_viewport_fit,
    _check_no_overlapping_ui,
)
from app.audits.code_audit import (
    run_code_audit,
    _check_no_eval,
    _check_no_var_declarations,
    _check_scene_cleanup,
    _check_no_direct_dom_access,
    _check_no_navigation_calls,
    _check_no_external_requests,
    _check_proper_this_usage,
)


# ── Shared sample code ────────────────────────────────────────────────────


VALID_PLATFORMER = """\
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
    }

    preload() { }

    create() {
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.player = this.physics.add.sprite(100, 450, 'player');
        this.player.setBounce(0.2);
        this.player.setCollideWorldBounds(true);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fill: '#000'
        });
    }

    update() {
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-400);
        }
    }

    destroy() { }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 500 }, debug: false }
    },
    scene: [GameScene]
};

const game = new Phaser.Game(config);
"""

CODE_MISSING_PHASER_GAME = """\
class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }
    preload() { }
    create() { this.player = this.add.sprite(100, 100, 'player'); }
    update() { }
}
"""

MINIMAL_VALID_UI = """\
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    scene: [GameScene]
};
const game = new Phaser.Game(config);
"""


# ══════════════════════════════════════════════════════════════════════════
# Logic Audit Tests
# ══════════════════════════════════════════════════════════════════════════


class TestRunLogicAudit:
    """Integration tests for run_logic_audit."""

    def test_valid_platformer_passes(self):
        result = run_logic_audit(VALID_PLATFORMER)
        assert result["passed"] is True
        assert result["score"] == 100
        assert len(result["details"]) == 8
        assert all(d["passed"] for d in result["details"])

    def test_empty_string_fails_gracefully(self):
        result = run_logic_audit("")
        assert result["passed"] is False
        assert result["score"] == 0
        assert result["details"][0]["check"] == "empty_code"

    def test_none_fails_gracefully(self):
        result = run_logic_audit(None)
        assert result["passed"] is False
        assert result["score"] == 0

    def test_whitespace_only_fails_gracefully(self):
        result = run_logic_audit("   \n\t  ")
        assert result["passed"] is False
        assert result["score"] == 0

    def test_code_missing_phaser_game_fails(self):
        result = run_logic_audit(CODE_MISSING_PHASER_GAME)
        assert result["passed"] is False
        failed_checks = [d["check"] for d in result["details"] if not d["passed"]]
        assert "phaser_game_constructor" in failed_checks

    def test_score_proportional_to_passes(self):
        """Score should reflect the fraction of checks that pass."""
        result = run_logic_audit(CODE_MISSING_PHASER_GAME)
        total = len(result["details"])
        passed = sum(1 for d in result["details"] if d["passed"])
        expected_score = int((passed / total) * 100)
        assert result["score"] == expected_score


class TestLogicAuditPlayerEntity:
    def test_this_player_assignment(self):
        result = _check_player_entity("this.player = this.physics.add.sprite(100, 100);")
        assert result["passed"] is True

    def test_let_player(self):
        result = _check_player_entity("let player = this.add.sprite(10, 10, 'p');")
        assert result["passed"] is True

    def test_const_player(self):
        result = _check_player_entity("const player = this.physics.add.sprite(0, 0);")
        assert result["passed"] is True

    def test_this_add_rectangle(self):
        result = _check_player_entity("this.add.rectangle(100, 200, 32, 32, 0xff0000);")
        assert result["passed"] is True

    def test_no_player_fails(self):
        result = _check_player_entity("console.log('no player here');")
        assert result["passed"] is False


class TestLogicAuditInputHandling:
    def test_cursor_keys(self):
        result = _check_input_handling("this.cursors = this.input.keyboard.createCursorKeys();")
        assert result["passed"] is True

    def test_add_key(self):
        result = _check_input_handling("this.input.keyboard.addKey('SPACE');")
        assert result["passed"] is True

    def test_pointer_event(self):
        result = _check_input_handling("this.input.on('pointerdown', callback);")
        assert result["passed"] is True

    def test_wasd(self):
        result = _check_input_handling("const wasd = this.input.keyboard.addKeys('W,A,S,D');")
        assert result["passed"] is True

    def test_no_input_fails(self):
        result = _check_input_handling("console.log('static game');")
        assert result["passed"] is False


class TestLogicAuditInfiniteLoops:
    def test_no_loops_passes(self):
        result = _check_no_infinite_loops("const x = 1;")
        assert result["passed"] is True

    def test_while_true_with_break_passes(self):
        result = _check_no_infinite_loops("while (true) { if (done) break; }")
        assert result["passed"] is True

    def test_while_true_with_return_passes(self):
        result = _check_no_infinite_loops("while (true) { return result; }")
        assert result["passed"] is True

    def test_while_true_no_break_fails(self):
        result = _check_no_infinite_loops("while (true) { doStuff(); }")
        assert result["passed"] is False

    def test_while_1_no_break_fails(self):
        result = _check_no_infinite_loops("while (1) { doStuff(); }")
        assert result["passed"] is False


class TestLogicAuditScoreOrState:
    def test_score_variable(self):
        result = _check_score_or_state("this.score = 0;")
        assert result["passed"] is True

    def test_game_over_variable(self):
        result = _check_score_or_state("let gameOver = false;")
        assert result["passed"] is True

    def test_lives(self):
        result = _check_score_or_state("this.lives = 3;")
        assert result["passed"] is True

    def test_health(self):
        result = _check_score_or_state("this.health = 100;")
        assert result["passed"] is True

    def test_level(self):
        result = _check_score_or_state("this.level = 1;")
        assert result["passed"] is True

    def test_score_text(self):
        result = _check_score_or_state("this.scoreText = this.add.text(0, 0, 'Score: 0');")
        assert result["passed"] is True

    def test_no_state_fails(self):
        result = _check_score_or_state("console.log('nothing');")
        assert result["passed"] is False


# ══════════════════════════════════════════════════════════════════════════
# UI Audit Tests
# ══════════════════════════════════════════════════════════════════════════


class TestRunUiAudit:
    """Integration tests for run_ui_audit."""

    def test_valid_config_passes(self):
        result = run_ui_audit(VALID_PLATFORMER)
        assert result["passed"] is True
        assert result["score"] == 100

    def test_empty_string_fails(self):
        result = run_ui_audit("")
        assert result["passed"] is False
        assert result["score"] == 0
        assert result["details"][0]["check"] == "empty_code"

    def test_none_fails(self):
        result = run_ui_audit(None)
        assert result["passed"] is False
        assert result["score"] == 0

    def test_whitespace_only_fails(self):
        result = run_ui_audit("   \t\n  ")
        assert result["passed"] is False
        assert result["score"] == 0


class TestCheckValidDimensions:
    def test_standard_800x600(self):
        result = _check_valid_dimensions("width: 800, height: 600")
        assert result["passed"] is True

    def test_missing_width_fails(self):
        result = _check_valid_dimensions("height: 600")
        assert result["passed"] is False

    def test_missing_height_fails(self):
        result = _check_valid_dimensions("width: 800")
        assert result["passed"] is False

    def test_missing_both_fails(self):
        result = _check_valid_dimensions("const config = {};")
        assert result["passed"] is False

    def test_zero_width_fails(self):
        result = _check_valid_dimensions("width: 0, height: 600")
        assert result["passed"] is False

    def test_oversized_width_fails(self):
        result = _check_valid_dimensions("width: 5000, height: 600")
        assert result["passed"] is False
        assert "out of range" in result["message"]

    def test_oversized_height_fails(self):
        result = _check_valid_dimensions("width: 800, height: 5000")
        assert result["passed"] is False

    def test_both_oversized_fails(self):
        result = _check_valid_dimensions("width: 5000, height: 5000")
        assert result["passed"] is False

    def test_boundary_4095_passes(self):
        result = _check_valid_dimensions("width: 4095, height: 4095")
        assert result["passed"] is True

    def test_boundary_4096_fails(self):
        result = _check_valid_dimensions("width: 4096, height: 600")
        assert result["passed"] is False

    def test_dynamic_window_dimensions_pass(self):
        code = "width: window.innerWidth, height: window.innerHeight"
        result = _check_valid_dimensions(code)
        assert result["passed"] is True

    def test_dynamic_width_only_passes(self):
        code = "width: window.innerWidth, height: 600"
        result = _check_valid_dimensions(code)
        assert result["passed"] is True

    def test_dynamic_height_only_passes(self):
        code = "width: 800, height: window.innerHeight"
        result = _check_valid_dimensions(code)
        assert result["passed"] is True


class TestCheckBackgroundColor:
    def test_hex_string(self):
        result = _check_background_color("backgroundColor: '#1a1a2e'")
        assert result["passed"] is True

    def test_hex_number(self):
        result = _check_background_color("backgroundColor: 0x1a1a2e")
        assert result["passed"] is True

    def test_camera_set_background(self):
        result = _check_background_color(
            "this.cameras.main.setBackgroundColor('#000000')"
        )
        assert result["passed"] is True

    def test_no_background_fails(self):
        result = _check_background_color("const config = { width: 800 };")
        assert result["passed"] is False


class TestCheckTextFontSizes:
    def test_valid_font_size_24(self):
        result = _check_text_font_sizes("fontSize: '24px'")
        assert result["passed"] is True

    def test_valid_font_size_range(self):
        code = "fontSize: '12px'\nfontSize: '72px'"
        result = _check_text_font_sizes(code)
        assert result["passed"] is True

    def test_too_small_font_fails(self):
        result = _check_text_font_sizes("fontSize: '8px'")
        assert result["passed"] is False

    def test_too_large_font_fails(self):
        result = _check_text_font_sizes("fontSize: '100px'")
        assert result["passed"] is False

    def test_set_font_size_valid(self):
        result = _check_text_font_sizes("setFontSize(32)")
        assert result["passed"] is True

    def test_set_font_size_too_small(self):
        result = _check_text_font_sizes("setFontSize(6)")
        assert result["passed"] is False

    def test_font_shorthand_valid(self):
        result = _check_text_font_sizes("font: '20px Arial'")
        assert result["passed"] is True

    def test_font_shorthand_too_large(self):
        result = _check_text_font_sizes("font: '80px Comic Sans'")
        assert result["passed"] is False

    def test_no_text_objects_passes(self):
        result = _check_text_font_sizes("const x = 1;")
        assert result["passed"] is True

    def test_text_objects_default_font_passes(self):
        result = _check_text_font_sizes("this.add.text(0, 0, 'Hello');")
        assert result["passed"] is True


class TestCheckViewportFit:
    def test_standard_800x600(self):
        result = _check_viewport_fit("width: 800, height: 600")
        assert result["passed"] is True

    def test_1920x1080(self):
        result = _check_viewport_fit("width: 1920, height: 1080")
        assert result["passed"] is True

    def test_exceeds_viewport(self):
        result = _check_viewport_fit("width: 2560, height: 1440")
        assert result["passed"] is False
        assert "exceed" in result["message"]

    def test_dynamic_sizing_passes(self):
        result = _check_viewport_fit("width: window.innerWidth, height: 600")
        assert result["passed"] is True

    def test_no_dimensions_passes(self):
        result = _check_viewport_fit("const config = {};")
        assert result["passed"] is True


class TestCheckNoOverlappingUI:
    def test_no_overlap(self):
        code = """\
this.add.text(16, 16, 'Score: 0');
this.add.text(16, 48, 'Lives: 3');
"""
        result = _check_no_overlapping_ui(code)
        assert result["passed"] is True

    def test_overlapping_text(self):
        code = """\
this.add.text(16, 16, 'Score: 0');
this.add.text(16, 16, 'Lives: 3');
"""
        result = _check_no_overlapping_ui(code)
        assert result["passed"] is False
        assert "overlap" in result["message"].lower()

    def test_single_element_passes(self):
        code = "this.add.text(16, 16, 'Score: 0');"
        result = _check_no_overlapping_ui(code)
        assert result["passed"] is True

    def test_no_ui_elements_passes(self):
        result = _check_no_overlapping_ui("const x = 1;")
        assert result["passed"] is True

    def test_overlapping_sprites(self):
        code = """\
this.add.sprite(100, 200, 'icon');
this.add.sprite(100, 200, 'icon2');
"""
        result = _check_no_overlapping_ui(code)
        assert result["passed"] is False


# ══════════════════════════════════════════════════════════════════════════
# Code Audit Tests
# ══════════════════════════════════════════════════════════════════════════


class TestRunCodeAudit:
    """Integration tests for run_code_audit."""

    def test_clean_code_passes(self):
        result = run_code_audit(VALID_PLATFORMER)
        assert result["passed"] is True
        assert result["score"] == 100

    def test_empty_string_fails(self):
        result = run_code_audit("")
        assert result["passed"] is False
        assert result["score"] == 0

    def test_none_fails(self):
        result = run_code_audit(None)
        assert result["passed"] is False
        assert result["score"] == 0

    def test_code_with_eval_fails(self):
        code = VALID_PLATFORMER + "\neval('alert(1)');"
        result = run_code_audit(code)
        assert result["passed"] is False
        failed_checks = [d["check"] for d in result["details"] if not d["passed"]]
        assert "no_eval_or_function" in failed_checks

    def test_code_with_var_flags(self):
        code = VALID_PLATFORMER.replace("const config", "var config")
        result = run_code_audit(code)
        assert result["passed"] is False
        failed_checks = [d["check"] for d in result["details"] if not d["passed"]]
        assert "no_var_declarations" in failed_checks


class TestCheckNoEval:
    def test_clean_code(self):
        assert _check_no_eval("const x = 1 + 2;")["passed"] is True

    def test_eval_detected(self):
        assert _check_no_eval("eval('code');")["passed"] is False

    def test_eval_with_spaces(self):
        assert _check_no_eval("eval  ('code');")["passed"] is False

    def test_new_function_detected(self):
        assert _check_no_eval("new Function('return 1');")["passed"] is False

    def test_function_keyword_ok(self):
        """Regular function declaration should not be flagged."""
        assert _check_no_eval("function myFunc() { return 1; }")["passed"] is True

    def test_both_eval_and_function(self):
        code = "eval('x');\nnew Function('return 1');"
        result = _check_no_eval(code)
        assert result["passed"] is False
        assert "eval()" in result["message"]
        assert "Function()" in result["message"]


class TestCheckNoVarDeclarations:
    def test_let_const_passes(self):
        result = _check_no_var_declarations("const x = 1;\nlet y = 2;")
        assert result["passed"] is True

    def test_var_detected(self):
        result = _check_no_var_declarations("var x = 10;")
        assert result["passed"] is False

    def test_var_in_comment_ignored(self):
        result = _check_no_var_declarations("// var oldStyle = 'legacy';\nconst x = 1;")
        assert result["passed"] is True

    def test_var_in_block_comment_ignored(self):
        result = _check_no_var_declarations("/* var x = 1; */\nconst y = 2;")
        assert result["passed"] is True

    def test_var_in_string_ignored(self):
        result = _check_no_var_declarations("const msg = 'use var for variables';")
        assert result["passed"] is True

    def test_multiple_vars_counted(self):
        code = "var a = 1;\nvar b = 2;\nvar c = 3;\nvar d = 4;\nvar e = 5;\nvar f = 6;"
        result = _check_no_var_declarations(code)
        assert result["passed"] is False
        assert "6 var declaration" in result["message"]
        assert "and 1 more" in result["message"]


class TestCheckNoDomAccess:
    def test_clean_phaser_code(self):
        result = _check_no_direct_dom_access("this.add.text(0, 0, 'Hello');")
        assert result["passed"] is True

    def test_get_element_by_id(self):
        result = _check_no_direct_dom_access("document.getElementById('game');")
        assert result["passed"] is False

    def test_query_selector(self):
        result = _check_no_direct_dom_access("document.querySelector('.game');")
        assert result["passed"] is False

    def test_inner_html(self):
        result = _check_no_direct_dom_access("element.innerHTML = '<p>hi</p>';")
        assert result["passed"] is False

    def test_document_write(self):
        result = _check_no_direct_dom_access("document.write('hello');")
        assert result["passed"] is False

    def test_document_cookie(self):
        result = _check_no_direct_dom_access("const c = document.cookie;")
        assert result["passed"] is False


class TestCheckNoNavigationCalls:
    def test_clean_code(self):
        result = _check_no_navigation_calls("this.scene.start('GameOver');")
        assert result["passed"] is True

    def test_window_location(self):
        result = _check_no_navigation_calls("window.location = 'http://evil.com';")
        assert result["passed"] is False

    def test_window_open(self):
        result = _check_no_navigation_calls("window.open('http://evil.com');")
        assert result["passed"] is False

    def test_history_push_state(self):
        result = _check_no_navigation_calls("history.pushState(null, '', '/new');")
        assert result["passed"] is False


class TestCheckNoExternalRequests:
    def test_clean_code(self):
        result = _check_no_external_requests("this.load.image('player', 'assets/player.png');")
        assert result["passed"] is True

    def test_fetch_detected(self):
        result = _check_no_external_requests("fetch('https://api.example.com/data');")
        assert result["passed"] is False

    def test_xhr_detected(self):
        result = _check_no_external_requests("const xhr = new XMLHttpRequest();")
        assert result["passed"] is False

    def test_websocket_detected(self):
        result = _check_no_external_requests("const ws = new WebSocket('ws://example.com');")
        assert result["passed"] is False

    def test_send_beacon_detected(self):
        result = _check_no_external_requests("navigator.sendBeacon('/log', data);")
        assert result["passed"] is False


class TestCheckProperThisUsage:
    def test_proper_usage(self):
        code = """\
class GameScene extends Phaser.Scene {
    create() {
        this.player = this.add.sprite(100, 100, 'p');
    }
    update() {
        this.player.setVelocityX(100);
    }
}
"""
        result = _check_proper_this_usage(code)
        assert result["passed"] is True

    def test_no_this_properties(self):
        result = _check_proper_this_usage("const x = 1;")
        assert result["passed"] is True

    def test_missing_this_on_property(self):
        code = """\
class GameScene extends Phaser.Scene {
    create() {
        this.player = this.add.sprite(100, 100, 'p');
    }
    update() {
        player.setVelocityX(100);
    }
}
"""
        result = _check_proper_this_usage(code)
        assert result["passed"] is False

    def test_local_variable_not_flagged(self):
        code = """\
class GameScene extends Phaser.Scene {
    create() {
        this.player = this.add.sprite(100, 100, 'p');
        const player = this.player;
        player.setVelocityX(100);
    }
}
"""
        result = _check_proper_this_usage(code)
        assert result["passed"] is True

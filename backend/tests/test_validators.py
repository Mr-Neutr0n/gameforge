"""Unit tests for validator regex patterns in tools.py, code_audit.py, and logic_audit.py.

Tests cover ES6 class syntax variants, arrow function scenes, module patterns,
whitespace handling (tabs, newlines), and edge cases for all regex-based checks.
"""

import pytest

from app.agents.tools import validate_phaser_config
from app.audits.code_audit import (
    _check_no_eval,
    _check_no_var_declarations,
    _check_scene_cleanup,
    run_code_audit,
)
from app.audits.logic_audit import (
    _check_phaser_game_exists,
    _check_scene_exists,
    _check_create_method,
    _check_update_method,
    run_logic_audit,
)


# ── Sample code snippets for testing ────────────────────────────────────


STANDARD_CLASS_GAME = """\
class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }
    preload() { }
    create() { this.player = this.add.sprite(100, 100, 'player'); }
    update() { }
}
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: [GameScene] };
const game = new Phaser.Game(config);
"""

ARROW_FUNCTION_SCENE = """\
const scene = {
    key: 'MainScene',
    preload: () => { },
    create: (data) => { },
    update: (time) => { },
};
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: scene };
const game = new Phaser.Game(config);
"""

ARROW_SINGLE_PARAM_SCENE = """\
const scene = {
    key: 'MainScene',
    preload: loader => { },
    create: data => { },
    update: time => { },
};
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: scene };
const game = new Phaser.Game(config);
"""

FUNCTION_PROPERTY_SCENE = """\
const scene = {
    key: 'MainScene',
    preload: function() { },
    create: function(data) { },
    update: function(time, delta) { },
};
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: [scene] };
const game = new Phaser.Game(config);
"""

MODULE_EXPORT_SCENE = """\
export default class MainScene extends Phaser.Scene {
    constructor() { super({ key: 'MainScene' }); }
    preload() { }
    create() { }
    update() { }
}
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: [MainScene] };
const game = new Phaser.Game(config);
"""

PARAMETERIZED_METHODS = """\
class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }
    preload(loader) { }
    create(data) { this.player = this.add.sprite(100, 100, 'player'); }
    update(time, delta) { }
}
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: [GameScene] };
const game = new Phaser.Game(config);
"""

WHITESPACE_VARIANTS = """\
class  GameScene  extends  Phaser . Scene {
    constructor() { super({ key: 'GameScene' }); }
    preload () { }
    create () { }
    update () { }
}
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: [GameScene] };
const game = new Phaser . Game(config);
"""

MISSING_EVERYTHING = "console.log('hello world');"

VAR_WITH_TAB = "var\tx = 10;"

VAR_WITH_NEWLINE = "var\nx = 10;"

VAR_IN_COMMENT = "// var oldStyle = 'legacy';\nconst x = 10;"

VAR_IN_STRING = "const msg = 'use var for variables';\nconst y = 20;"

CODE_WITH_EVAL = "const result = eval('2 + 2');"

CODE_WITH_NEW_FUNCTION = "const fn = new Function('a', 'return a + 1');"

CLEAN_CODE = """\
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
    }
    preload() { }
    create() {
        this.player = this.physics.add.sprite(100, 100, 'player');
        this.cursors = this.input.keyboard.createCursorKeys();
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px' });
    }
    update() {
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
        }
    }
    destroy() { }
}
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: [GameScene]
};
const game = new Phaser.Game(config);
"""


# ── validate_phaser_config tests ────────────────────────────────────────


class TestValidatePhaserConfig:
    """Tests for the validate_phaser_config function in tools.py."""

    def test_standard_class_game(self):
        result = validate_phaser_config(STANDARD_CLASS_GAME)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_arrow_function_scene(self):
        result = validate_phaser_config(ARROW_FUNCTION_SCENE)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_arrow_single_param_scene(self):
        result = validate_phaser_config(ARROW_SINGLE_PARAM_SCENE)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_function_property_scene(self):
        result = validate_phaser_config(FUNCTION_PROPERTY_SCENE)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_module_export_scene(self):
        result = validate_phaser_config(MODULE_EXPORT_SCENE)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_parameterized_methods(self):
        result = validate_phaser_config(PARAMETERIZED_METHODS)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_whitespace_variants(self):
        result = validate_phaser_config(WHITESPACE_VARIANTS)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_missing_everything(self):
        result = validate_phaser_config(MISSING_EVERYTHING)
        assert result["valid"] is False
        assert "Missing Phaser.Game constructor" in result["errors"]
        assert "Missing preload() method" in result["errors"]
        assert "Missing create() method" in result["errors"]
        assert "Missing update() method" in result["errors"]
        assert "No Phaser.Scene subclass or scene config found" in result["errors"]

    def test_missing_only_preload(self):
        code = """\
class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }
    create() { }
    update() { }
}
const config = { scene: [GameScene] };
const game = new Phaser.Game(config);
"""
        result = validate_phaser_config(code)
        assert result["valid"] is False
        assert "Missing preload() method" in result["errors"]
        assert len(result["errors"]) == 1

    def test_scene_config_variable_reference(self):
        """scene: MyScene (variable reference, not array/object)."""
        code = """\
class MyScene extends Phaser.Scene {
    preload() { }
    create() { }
    update() { }
}
const config = { scene: MyScene };
const game = new Phaser.Game(config);
"""
        result = validate_phaser_config(code)
        assert result["valid"] is True


# ── code_audit regex tests ──────────────────────────────────────────────


class TestCheckNoEval:
    def test_clean_code(self):
        assert _check_no_eval(CLEAN_CODE)["passed"] is True

    def test_eval_detected(self):
        assert _check_no_eval(CODE_WITH_EVAL)["passed"] is False

    def test_new_function_detected(self):
        assert _check_no_eval(CODE_WITH_NEW_FUNCTION)["passed"] is False


class TestCheckNoVarDeclarations:
    def test_clean_code_no_var(self):
        result = _check_no_var_declarations("const x = 1;\nlet y = 2;")
        assert result["passed"] is True

    def test_var_with_space(self):
        result = _check_no_var_declarations("var x = 10;")
        assert result["passed"] is False

    def test_var_with_tab(self):
        result = _check_no_var_declarations(VAR_WITH_TAB)
        assert result["passed"] is False

    def test_var_with_newline(self):
        result = _check_no_var_declarations(VAR_WITH_NEWLINE)
        assert result["passed"] is False

    def test_var_in_comment_ignored(self):
        """var inside a single-line comment should not be flagged."""
        result = _check_no_var_declarations(VAR_IN_COMMENT)
        assert result["passed"] is True

    def test_var_in_string_ignored(self):
        """var inside a string literal should not be flagged."""
        result = _check_no_var_declarations(VAR_IN_STRING)
        assert result["passed"] is True

    def test_multiple_var_declarations(self):
        code = "var a = 1;\nvar b = 2;\nvar c = 3;"
        result = _check_no_var_declarations(code)
        assert result["passed"] is False
        assert "3 var declaration" in result["message"]


class TestCheckSceneCleanup:
    def test_scene_with_destroy(self):
        code = """\
class GameScene extends Phaser.Scene {
    create() { }
    destroy() { }
}
"""
        result = _check_scene_cleanup(code)
        assert result["passed"] is True

    def test_scene_without_cleanup(self):
        code = """\
class GameScene extends Phaser.Scene {
    create() { }
    update() { }
}
"""
        result = _check_scene_cleanup(code)
        assert result["passed"] is False

    def test_scene_with_shutdown_event(self):
        code = """\
class GameScene extends Phaser.Scene {
    create() {
        this.events.on('shutdown', () => { });
    }
}
"""
        result = _check_scene_cleanup(code)
        assert result["passed"] is True

    def test_no_scene_classes(self):
        """No scene classes — cleanup check should be N/A (pass)."""
        result = _check_scene_cleanup("const x = 1;")
        assert result["passed"] is True

    def test_scene_with_flexible_whitespace(self):
        """Scene class with space between Phaser and .Scene."""
        code = """\
class GameScene extends Phaser .Scene {
    create() { }
    destroy() { }
}
"""
        result = _check_scene_cleanup(code)
        assert result["passed"] is True


# ── logic_audit regex tests ─────────────────────────────────────────────


class TestCheckPhaserGameExists:
    def test_standard_constructor(self):
        result = _check_phaser_game_exists("const game = new Phaser.Game(config);")
        assert result["passed"] is True

    def test_whitespace_in_constructor(self):
        result = _check_phaser_game_exists("const game = new Phaser . Game(config);")
        assert result["passed"] is True

    def test_missing_constructor(self):
        result = _check_phaser_game_exists("console.log('no game here');")
        assert result["passed"] is False


class TestCheckSceneExists:
    def test_class_scene(self):
        result = _check_scene_exists("class GameScene extends Phaser.Scene {}")
        assert result["passed"] is True

    def test_class_scene_flexible_whitespace(self):
        result = _check_scene_exists("class GameScene extends Phaser . Scene {}")
        assert result["passed"] is True

    def test_scene_config_array(self):
        result = _check_scene_exists("scene: [GameScene]")
        assert result["passed"] is True

    def test_scene_config_object(self):
        result = _check_scene_exists("scene: { key: 'main' }")
        assert result["passed"] is True

    def test_scene_variable_reference(self):
        result = _check_scene_exists("scene: MainScene")
        assert result["passed"] is True

    def test_export_default_class(self):
        result = _check_scene_exists(
            "export default class MainScene extends Phaser.Scene {}"
        )
        assert result["passed"] is True

    def test_export_class(self):
        result = _check_scene_exists(
            "export class MainScene extends Phaser.Scene {}"
        )
        assert result["passed"] is True

    def test_no_scene_at_all(self):
        result = _check_scene_exists("const x = 1;")
        assert result["passed"] is False


class TestCheckCreateMethod:
    def test_class_method_no_params(self):
        result = _check_create_method("create() { }")
        assert result["passed"] is True

    def test_class_method_with_params(self):
        result = _check_create_method("create(data) { }")
        assert result["passed"] is True

    def test_function_property(self):
        result = _check_create_method("create: function() { }")
        assert result["passed"] is True

    def test_function_property_with_params(self):
        result = _check_create_method("create: function(data) { }")
        assert result["passed"] is True

    def test_arrow_function_no_params(self):
        result = _check_create_method("create: () => { }")
        assert result["passed"] is True

    def test_arrow_function_with_params(self):
        result = _check_create_method("create: (data) => { }")
        assert result["passed"] is True

    def test_arrow_single_param(self):
        result = _check_create_method("create: data => { }")
        assert result["passed"] is True

    def test_missing_create(self):
        result = _check_create_method("update() { }")
        assert result["passed"] is False


class TestCheckUpdateMethod:
    def test_class_method_no_params(self):
        result = _check_update_method("update() { }")
        assert result["passed"] is True

    def test_class_method_with_params(self):
        result = _check_update_method("update(time, delta) { }")
        assert result["passed"] is True

    def test_function_property(self):
        result = _check_update_method("update: function(time) { }")
        assert result["passed"] is True

    def test_arrow_function(self):
        result = _check_update_method("update: () => { }")
        assert result["passed"] is True

    def test_arrow_single_param(self):
        result = _check_update_method("update: time => { }")
        assert result["passed"] is True

    def test_missing_update(self):
        result = _check_update_method("create() { }")
        assert result["passed"] is False


# ── Full audit integration tests ────────────────────────────────────────


class TestRunCodeAuditIntegration:
    def test_clean_code_passes(self):
        result = run_code_audit(CLEAN_CODE)
        assert result["passed"] is True
        assert result["score"] == 100

    def test_empty_string_fails(self):
        result = run_code_audit("")
        assert result["passed"] is False
        assert result["score"] == 0

    def test_whitespace_only_fails(self):
        result = run_code_audit("   \n\t  ")
        assert result["passed"] is False

    def test_code_with_eval_fails(self):
        code = CLEAN_CODE + "\neval('alert(1)');"
        result = run_code_audit(code)
        assert result["passed"] is False
        failed = [d for d in result["details"] if not d["passed"]]
        checks = [d["check"] for d in failed]
        assert "no_eval_or_function" in checks

    def test_code_with_var_fails(self):
        code = CLEAN_CODE.replace("const config", "var config")
        result = run_code_audit(code)
        assert result["passed"] is False
        failed = [d for d in result["details"] if not d["passed"]]
        checks = [d["check"] for d in failed]
        assert "no_var_declarations" in checks


class TestRunLogicAuditIntegration:
    def test_valid_platformer_passes(self):
        result = run_logic_audit(CLEAN_CODE)
        assert result["passed"] is True
        assert result["score"] == 100

    def test_empty_string_fails(self):
        result = run_logic_audit("")
        assert result["passed"] is False
        assert result["score"] == 0

    def test_missing_phaser_game(self):
        code = """\
class GameScene extends Phaser.Scene {
    preload() { }
    create() { this.player = this.add.sprite(100, 100, 'player'); }
    update() { }
}
"""
        result = run_logic_audit(code)
        assert result["passed"] is False
        failed = [d for d in result["details"] if not d["passed"]]
        checks = [d["check"] for d in failed]
        assert "phaser_game_constructor" in checks

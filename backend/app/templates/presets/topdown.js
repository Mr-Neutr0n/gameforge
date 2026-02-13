// ============================================================
// GameForge Preset: Top-Down
// A top-down adventure with 4-directional WASD movement,
// tile-based map, collectible gems, and enemies.
// ============================================================

// --- GAME CONFIGURATION (agent: adjust dimensions, physics) ---
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1b1b2f',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [GameScene]
};

// --- MAIN GAME SCENE ---
function GameScene() {
  Phaser.Scene.call(this, { key: 'GameScene' });
}

GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.create = function () {
  // --- TILE MAP (agent: modify map layout, tile size, colors) ---
  const tileSize = 40;
  const mapCols = 20;
  const mapRows = 15;
  const worldWidth = mapCols * tileSize;
  const worldHeight = mapRows * tileSize;

  // 0 = floor, 1 = wall
  const mapData = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  // --- RENDER MAP ---
  this.walls = this.physics.add.staticGroup();

  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      const x = col * tileSize + tileSize / 2;
      const y = row * tileSize + tileSize / 2;

      if (mapData[row][col] === 1) {
        // Wall tile
        const wall = this.add.rectangle(x, y, tileSize, tileSize, 0x162447);
        this.physics.add.existing(wall, true);
        this.walls.add(wall);

        // Wall border effect
        this.add.rectangle(x, y, tileSize - 2, tileSize - 2, 0x1f4068).setDepth(0);
      } else {
        // Floor tile with subtle pattern
        const shade = ((row + col) % 2 === 0) ? 0x1b1b2f : 0x1e1e35;
        this.add.rectangle(x, y, tileSize, tileSize, shade).setDepth(-1);
      }
    }
  }

  // --- PLAYER (agent: adjust size, color, speed) ---
  this.player = this.add.rectangle(3 * tileSize + 20, 1 * tileSize + 20, 28, 28, 0x22d3ee);
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.setDepth(5);

  // Player direction indicator (small triangle)
  this.playerDir = this.add.triangle(this.player.x, this.player.y - 18, 0, 8, 5, 0, -5, 0, 0x22d3ee);
  this.playerDir.setDepth(6);

  // --- GEMS (agent: adjust positions, scoring) ---
  this.gems = this.physics.add.group();
  const gemPositions = [
    { x: 5, y: 1 }, { x: 8, y: 2 }, { x: 11, y: 1 },
    { x: 15, y: 2 }, { x: 18, y: 4 }, { x: 2, y: 5 },
    { x: 8, y: 8 }, { x: 14, y: 7 }, { x: 18, y: 8 },
    { x: 2, y: 10 }, { x: 7, y: 11 }, { x: 14, y: 10 },
    { x: 18, y: 12 }, { x: 5, y: 13 }, { x: 10, y: 13 }
  ];

  gemPositions.forEach(function (pos) {
    const gx = pos.x * tileSize + tileSize / 2;
    const gy = pos.y * tileSize + tileSize / 2;
    const gem = this.add.star(gx, gy, 5, 4, 10, 0xa855f7);
    this.physics.add.existing(gem);
    gem.body.setImmovable(true);
    gem.setDepth(3);
    this.gems.add(gem);
  }, this);

  // --- ENEMIES (agent: modify enemy behavior, patrol paths) ---
  this.enemies = this.physics.add.group();
  const enemyData = [
    { x: 5, y: 6, axis: 'x', min: 1 * tileSize, max: 6 * tileSize, speed: 80 },
    { x: 14, y: 4, axis: 'y', min: 3 * tileSize, max: 8 * tileSize, speed: 60 },
    { x: 10, y: 10, axis: 'x', min: 7 * tileSize, max: 14 * tileSize, speed: 90 },
    { x: 17, y: 11, axis: 'y', min: 9 * tileSize, max: 13 * tileSize, speed: 70 }
  ];

  enemyData.forEach(function (e) {
    const ex = e.x * tileSize + tileSize / 2;
    const ey = e.y * tileSize + tileSize / 2;
    const enemy = this.add.rectangle(ex, ey, 26, 26, 0xe94560);
    this.physics.add.existing(enemy);
    enemy.body.setImmovable(true);
    enemy.setDepth(4);
    enemy.patrolAxis = e.axis;
    enemy.patrolMin = e.min;
    enemy.patrolMax = e.max;
    if (e.axis === 'x') {
      enemy.body.setVelocityX(e.speed);
    } else {
      enemy.body.setVelocityY(e.speed);
    }
    this.enemies.add(enemy);
  }, this);

  // --- COLLISIONS ---
  this.physics.add.collider(this.player, this.walls);
  this.physics.add.collider(this.enemies, this.walls, function (enemy) {
    // Bounce enemies off walls
    if (enemy.patrolAxis === 'x') {
      enemy.body.setVelocityX(-enemy.body.velocity.x);
    } else {
      enemy.body.setVelocityY(-enemy.body.velocity.y);
    }
  });
  this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
  this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);

  // --- INPUT (WASD + Arrow Keys) ---
  this.keys = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
    arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
    arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
    arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT
  });

  // --- SCORE (agent: adjust font, color) ---
  this.score = 0;
  this.totalGems = gemPositions.length;
  this.scoreText = this.add.text(16, 16, 'Gems: 0 / ' + this.totalGems, {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#a855f7',
    stroke: '#000000',
    strokeThickness: 3
  }).setScrollFactor(0).setDepth(10);

  // --- LIVES ---
  this.lives = 3;
  this.livesText = this.add.text(16, 42, 'Lives: 3', {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#e94560',
    stroke: '#000000',
    strokeThickness: 3
  }).setScrollFactor(0).setDepth(10);

  // --- GAME STATE ---
  this.isGameOver = false;
  this.invincible = false;
};

GameScene.prototype.update = function () {
  if (this.isGameOver) return;

  var body = this.player.body;
  var speed = 180;

  // --- MOVEMENT (agent: adjust speed) ---
  var vx = 0;
  var vy = 0;

  if (this.keys.left.isDown || this.keys.arrowLeft.isDown) vx = -speed;
  else if (this.keys.right.isDown || this.keys.arrowRight.isDown) vx = speed;

  if (this.keys.up.isDown || this.keys.arrowUp.isDown) vy = -speed;
  else if (this.keys.down.isDown || this.keys.arrowDown.isDown) vy = speed;

  // Normalize diagonal movement
  if (vx !== 0 && vy !== 0) {
    vx *= 0.707;
    vy *= 0.707;
  }

  body.setVelocity(vx, vy);

  // Update direction indicator
  this.playerDir.setPosition(this.player.x, this.player.y - 18);
  if (vx > 0) this.playerDir.setAngle(90);
  else if (vx < 0) this.playerDir.setAngle(-90);
  else if (vy > 0) this.playerDir.setAngle(180);
  else if (vy < 0) this.playerDir.setAngle(0);

  // --- ENEMY PATROL ---
  this.enemies.getChildren().forEach(function (enemy) {
    if (enemy.patrolAxis === 'x') {
      if (enemy.x <= enemy.patrolMin + 20) {
        enemy.body.setVelocityX(Math.abs(enemy.body.velocity.x) || 80);
      } else if (enemy.x >= enemy.patrolMax - 20) {
        enemy.body.setVelocityX(-Math.abs(enemy.body.velocity.x) || -80);
      }
    } else {
      if (enemy.y <= enemy.patrolMin + 20) {
        enemy.body.setVelocityY(Math.abs(enemy.body.velocity.y) || 80);
      } else if (enemy.y >= enemy.patrolMax - 20) {
        enemy.body.setVelocityY(-Math.abs(enemy.body.velocity.y) || -80);
      }
    }
  });

  // Gem rotation animation
  this.gems.getChildren().forEach(function (gem) {
    gem.setAngle(gem.angle + 2);
  });
};

// --- GEM COLLECTION (agent: modify scoring, effects) ---
GameScene.prototype.collectGem = function (player, gem) {
  gem.destroy();
  this.score += 1;
  this.scoreText.setText('Gems: ' + this.score + ' / ' + this.totalGems);

  this.cameras.main.flash(80, 168, 85, 247, true);

  if (this.gems.countActive() === 0) {
    this.winGame();
  }
};

// --- ENEMY COLLISION (agent: modify damage, knockback) ---
GameScene.prototype.hitEnemy = function (player, enemy) {
  if (this.invincible) return;

  this.lives -= 1;
  this.livesText.setText('Lives: ' + this.lives);

  if (this.lives <= 0) {
    this.gameOver();
    return;
  }

  // Knockback
  var dx = player.x - enemy.x;
  var dy = player.y - enemy.y;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  player.body.setVelocity((dx / len) * 300, (dy / len) * 300);

  // Brief invincibility
  this.invincible = true;
  this.player.setAlpha(0.5);
  this.time.delayedCall(1000, function () {
    this.invincible = false;
    this.player.setAlpha(1);
  }, [], this);

  this.cameras.main.shake(100, 0.01);
};

GameScene.prototype.winGame = function () {
  this.isGameOver = true;
  this.player.body.setVelocity(0, 0);

  this.add.text(400, 300, 'ALL GEMS COLLECTED!\nClick to restart', {
    fontFamily: 'monospace',
    fontSize: '28px',
    color: '#a855f7',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(20);

  this.input.once('pointerdown', function () {
    this.isGameOver = false;
    this.scene.restart();
  }, this);
};

GameScene.prototype.gameOver = function () {
  this.isGameOver = true;
  this.player.body.setVelocity(0, 0);

  this.add.text(400, 300, 'GAME OVER\nGems: ' + this.score + ' / ' + this.totalGems + '\nClick to restart', {
    fontFamily: 'monospace',
    fontSize: '28px',
    color: '#e94560',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(20);

  this.input.once('pointerdown', function () {
    this.isGameOver = false;
    this.scene.restart();
  }, this);
};

// --- START GAME ---
const game = new Phaser.Game(config);

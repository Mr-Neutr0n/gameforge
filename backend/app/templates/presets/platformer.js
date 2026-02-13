// ============================================================
// GameForge Preset: Platformer
// A side-scrolling platformer with gravity, platforms, and
// arrow-key controls. The player jumps between platforms,
// collects coins, and the camera follows the player.
// ============================================================

// --- GAME CONFIGURATION (agent: adjust dimensions, physics) ---
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
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
  // --- WORLD BOUNDS (agent: adjust world size) ---
  this.physics.world.setBounds(0, 0, 2400, 600);
  this.cameras.main.setBounds(0, 0, 2400, 600);

  // --- BACKGROUND ---
  // Draw a gradient-style background with layered rectangles
  for (let i = 0; i < 5; i++) {
    const bg = this.add.rectangle(1200, 300 + i * 30, 2400, 600, 0x16213e, 0.3 - i * 0.05);
    bg.setScrollFactor(0.1 + i * 0.1);
  }

  // --- PLATFORMS (agent: modify positions, sizes, colors) ---
  this.platforms = this.physics.add.staticGroup();

  // Ground
  const ground = this.add.rectangle(1200, 590, 2400, 40, 0x0f3460);
  this.physics.add.existing(ground, true);
  this.platforms.add(ground);

  // Floating platforms
  const platformData = [
    { x: 200, y: 450, w: 160, h: 20 },
    { x: 450, y: 350, w: 160, h: 20 },
    { x: 700, y: 280, w: 200, h: 20 },
    { x: 1000, y: 400, w: 160, h: 20 },
    { x: 1250, y: 300, w: 200, h: 20 },
    { x: 1500, y: 450, w: 160, h: 20 },
    { x: 1750, y: 350, w: 180, h: 20 },
    { x: 2000, y: 280, w: 200, h: 20 },
    { x: 2200, y: 400, w: 160, h: 20 }
  ];

  platformData.forEach(function (p) {
    const plat = this.add.rectangle(p.x, p.y, p.w, p.h, 0x533483);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);
  }, this);

  // --- PLAYER (agent: adjust size, color, speed, jump power) ---
  this.player = this.add.rectangle(100, 500, 32, 40, 0x22d3ee);
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.body.setBounce(0.1);

  // --- COINS (agent: adjust positions, count, colors) ---
  this.coins = this.physics.add.group();
  const coinPositions = [
    { x: 200, y: 400 }, { x: 450, y: 300 }, { x: 700, y: 230 },
    { x: 1000, y: 350 }, { x: 1250, y: 250 }, { x: 1500, y: 400 },
    { x: 1750, y: 300 }, { x: 2000, y: 230 }, { x: 2200, y: 350 }
  ];

  coinPositions.forEach(function (pos) {
    const coin = this.add.circle(pos.x, pos.y, 10, 0xe94560);
    this.physics.add.existing(coin);
    coin.body.setAllowGravity(false);
    coin.body.setImmovable(true);
    this.coins.add(coin);
  }, this);

  // --- ENEMIES (agent: modify enemy behavior, count, speed) ---
  this.enemies = this.physics.add.group();
  const enemyPositions = [
    { x: 700, y: 250, minX: 620, maxX: 880 },
    { x: 1250, y: 270, minX: 1170, maxX: 1430 },
    { x: 2000, y: 250, minX: 1920, maxX: 2180 }
  ];

  enemyPositions.forEach(function (e) {
    const enemy = this.add.rectangle(e.x, e.y, 28, 28, 0xff6b6b);
    this.physics.add.existing(enemy);
    enemy.body.setAllowGravity(false);
    enemy.body.setImmovable(true);
    enemy.body.setVelocityX(60);
    enemy.patrolMin = e.minX;
    enemy.patrolMax = e.maxX;
    this.enemies.add(enemy);
  }, this);

  // --- COLLISIONS ---
  this.physics.add.collider(this.player, this.platforms);
  this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
  this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);

  // --- CAMERA (agent: adjust zoom, lerp) ---
  this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

  // --- INPUT ---
  this.cursors = this.input.keyboard.createCursorKeys();

  // --- SCORE (agent: adjust font, position, color) ---
  this.score = 0;
  this.scoreText = this.add.text(16, 16, 'Score: 0', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#22d3ee',
    stroke: '#000000',
    strokeThickness: 3
  }).setScrollFactor(0).setDepth(10);

  // --- LIVES ---
  this.lives = 3;
  this.livesText = this.add.text(16, 44, 'Lives: 3', {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#e94560',
    stroke: '#000000',
    strokeThickness: 3
  }).setScrollFactor(0).setDepth(10);

  // --- GAME OVER FLAG ---
  this.isGameOver = false;
};

GameScene.prototype.update = function () {
  if (this.isGameOver) return;

  var body = this.player.body;

  // --- PLAYER MOVEMENT (agent: adjust speeds) ---
  var speed = 250;
  var jumpPower = -420;

  if (this.cursors.left.isDown) {
    body.setVelocityX(-speed);
  } else if (this.cursors.right.isDown) {
    body.setVelocityX(speed);
  } else {
    body.setVelocityX(0);
  }

  // Jump only when touching ground
  if (this.cursors.up.isDown && body.blocked.down) {
    body.setVelocityY(jumpPower);
  }

  // --- ENEMY PATROL ---
  this.enemies.getChildren().forEach(function (enemy) {
    if (enemy.x <= enemy.patrolMin) {
      enemy.body.setVelocityX(60);
    } else if (enemy.x >= enemy.patrolMax) {
      enemy.body.setVelocityX(-60);
    }
  });

  // --- FALL DEATH ---
  if (this.player.y > 580) {
    this.loseLife();
  }
};

// --- COIN COLLECTION (agent: modify scoring, effects) ---
GameScene.prototype.collectCoin = function (player, coin) {
  coin.destroy();
  this.score += 10;
  this.scoreText.setText('Score: ' + this.score);

  // Flash effect
  this.cameras.main.flash(100, 34, 211, 238, true);

  // Win check
  if (this.coins.countActive() === 0) {
    this.winGame();
  }
};

// --- ENEMY HIT (agent: modify penalty, knockback) ---
GameScene.prototype.hitEnemy = function (player, enemy) {
  // If player is falling onto enemy, destroy the enemy
  if (player.body.velocity.y > 0 && player.y < enemy.y - 10) {
    enemy.destroy();
    this.score += 25;
    this.scoreText.setText('Score: ' + this.score);
    player.body.setVelocityY(-300);
  } else {
    this.loseLife();
  }
};

GameScene.prototype.loseLife = function () {
  this.lives -= 1;
  this.livesText.setText('Lives: ' + this.lives);

  if (this.lives <= 0) {
    this.gameOver();
  } else {
    // Reset player position
    this.player.setPosition(100, 500);
    this.player.body.setVelocity(0, 0);
    this.cameras.main.flash(200, 233, 69, 96, true);
  }
};

GameScene.prototype.winGame = function () {
  this.isGameOver = true;
  var winText = this.add.text(400, 300, 'YOU WIN!\nScore: ' + this.score + '\nClick to restart', {
    fontFamily: 'monospace',
    fontSize: '32px',
    color: '#22d3ee',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

  this.input.once('pointerdown', function () {
    this.isGameOver = false;
    this.scene.restart();
  }, this);
};

GameScene.prototype.gameOver = function () {
  this.isGameOver = true;
  this.player.body.setVelocity(0, 0);

  var gameOverText = this.add.text(400, 300, 'GAME OVER\nScore: ' + this.score + '\nClick to restart', {
    fontFamily: 'monospace',
    fontSize: '32px',
    color: '#e94560',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

  this.input.once('pointerdown', function () {
    this.isGameOver = false;
    this.scene.restart();
  }, this);
};

// --- START GAME ---
const game = new Phaser.Game(config);

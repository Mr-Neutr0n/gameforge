// ============================================================
// GameForge Preset: Space Shooter
// A vertical shooter where the player ship moves left/right,
// enemies spawn from the top, spacebar to shoot, with scoring.
// ============================================================

// --- GAME CONFIGURATION (agent: adjust dimensions, physics) ---
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#0a0a1a',
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
  // --- STARFIELD BACKGROUND ---
  this.stars = [];
  for (let i = 0; i < 100; i++) {
    const star = this.add.circle(
      Phaser.Math.Between(0, 800),
      Phaser.Math.Between(0, 600),
      Phaser.Math.Between(1, 2),
      0xffffff,
      Phaser.Math.FloatBetween(0.2, 0.8)
    );
    star.scrollSpeed = Phaser.Math.FloatBetween(0.5, 2);
    this.stars.push(star);
  }

  // --- PLAYER SHIP (agent: adjust size, color, speed) ---
  // Ship body
  this.player = this.add.triangle(400, 540, 0, 30, 15, 0, 30, 30, 0x22d3ee);
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.body.setSize(24, 24);
  this.player.body.setOffset(3, 3);
  this.player.setDepth(5);

  // Engine glow
  this.engineGlow = this.add.circle(this.player.x, this.player.y + 18, 5, 0x3b82f6, 0.8);
  this.engineGlow.setDepth(4);

  // --- BULLETS ---
  this.bullets = this.physics.add.group({
    maxSize: 30,
    allowGravity: false
  });

  // --- ENEMIES (agent: modify spawn rate, types, speed) ---
  this.enemies = this.physics.add.group({
    allowGravity: false
  });

  // --- ENEMY BULLETS ---
  this.enemyBullets = this.physics.add.group({
    maxSize: 20,
    allowGravity: false
  });

  // --- EXPLOSIONS (particle-like effect using circles) ---
  this.explosionParts = [];

  // --- COLLISIONS ---
  this.physics.add.overlap(this.bullets, this.enemies, this.bulletHitEnemy, null, this);
  this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
  this.physics.add.overlap(this.player, this.enemyBullets, this.playerHitBullet, null, this);

  // --- INPUT ---
  this.cursors = this.input.keyboard.createCursorKeys();
  this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // --- SCORE (agent: adjust font, color) ---
  this.score = 0;
  this.scoreText = this.add.text(16, 16, 'Score: 0', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#22d3ee',
    stroke: '#000000',
    strokeThickness: 3
  }).setDepth(10);

  // --- WAVE DISPLAY ---
  this.wave = 1;
  this.waveText = this.add.text(800 - 16, 16, 'Wave: 1', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#a855f7',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(1, 0).setDepth(10);

  // --- LIVES ---
  this.lives = 3;
  this.livesText = this.add.text(16, 44, 'Lives: 3', {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#e94560',
    stroke: '#000000',
    strokeThickness: 3
  }).setDepth(10);

  // --- GAME STATE ---
  this.isGameOver = false;
  this.lastFired = 0;
  this.fireRate = 200;
  this.invincible = false;

  // --- ENEMY SPAWNING (agent: adjust timing, difficulty) ---
  this.enemySpawnTimer = this.time.addEvent({
    delay: 1200,
    callback: this.spawnEnemy,
    callbackScope: this,
    loop: true
  });

  // Wave progression
  this.enemiesKilled = 0;
  this.enemiesPerWave = 10;
};

GameScene.prototype.update = function (time) {
  if (this.isGameOver) return;

  var body = this.player.body;
  var speed = 300;

  // --- PLAYER MOVEMENT (agent: adjust speed) ---
  if (this.cursors.left.isDown) {
    body.setVelocityX(-speed);
  } else if (this.cursors.right.isDown) {
    body.setVelocityX(speed);
  } else {
    body.setVelocityX(0);
  }

  // Also allow up/down movement
  if (this.cursors.up.isDown) {
    body.setVelocityY(-speed * 0.6);
  } else if (this.cursors.down.isDown) {
    body.setVelocityY(speed * 0.6);
  } else {
    body.setVelocityY(0);
  }

  // Clamp vertical position
  if (this.player.y < 400) {
    this.player.y = 400;
    body.setVelocityY(0);
  }

  // Update engine glow position
  this.engineGlow.setPosition(this.player.x, this.player.y + 18);
  this.engineGlow.setAlpha(Phaser.Math.FloatBetween(0.5, 1.0));

  // --- SHOOTING (agent: adjust fire rate, bullet speed) ---
  if (this.spaceKey.isDown && time > this.lastFired) {
    this.fireBullet();
    this.lastFired = time + this.fireRate;
  }

  // --- STARFIELD SCROLL ---
  for (let i = 0; i < this.stars.length; i++) {
    var star = this.stars[i];
    star.y += star.scrollSpeed;
    if (star.y > 610) {
      star.y = -10;
      star.x = Phaser.Math.Between(0, 800);
    }
  }

  // --- CLEANUP off-screen objects ---
  this.bullets.getChildren().forEach(function (bullet) {
    if (bullet.active && bullet.y < -20) {
      bullet.setActive(false);
      bullet.setVisible(false);
      bullet.body.stop();
    }
  });

  this.enemies.getChildren().forEach(function (enemy) {
    if (enemy.active && enemy.y > 650) {
      enemy.setActive(false);
      enemy.setVisible(false);
      enemy.body.stop();
    }
  });

  this.enemyBullets.getChildren().forEach(function (bullet) {
    if (bullet.active && bullet.y > 650) {
      bullet.setActive(false);
      bullet.setVisible(false);
      bullet.body.stop();
    }
  });

  // --- UPDATE EXPLOSIONS ---
  for (let i = this.explosionParts.length - 1; i >= 0; i--) {
    var part = this.explosionParts[i];
    part.life -= 1;
    part.setAlpha(part.life / part.maxLife);
    part.setScale(1 + (1 - part.life / part.maxLife) * 0.5);
    if (part.life <= 0) {
      part.destroy();
      this.explosionParts.splice(i, 1);
    }
  }
};

// --- FIRE BULLET (agent: modify bullet appearance, speed) ---
GameScene.prototype.fireBullet = function () {
  var bullet = this.bullets.getFirstDead(true, this.player.x, this.player.y - 20, null, null, true);
  if (!bullet) {
    bullet = this.add.rectangle(this.player.x, this.player.y - 20, 4, 14, 0x22d3ee);
    this.physics.add.existing(bullet);
    bullet.body.setAllowGravity(false);
    this.bullets.add(bullet);
  }
  bullet.setPosition(this.player.x, this.player.y - 20);
  bullet.setActive(true);
  bullet.setVisible(true);
  bullet.body.setVelocityY(-500);
};

// --- SPAWN ENEMY (agent: modify enemy types, patterns) ---
GameScene.prototype.spawnEnemy = function () {
  if (this.isGameOver) return;

  var x = Phaser.Math.Between(40, 760);
  var enemyType = Phaser.Math.Between(0, 2);
  var enemy;

  if (enemyType === 0) {
    // Standard enemy — red square, moves straight down
    enemy = this.add.rectangle(x, -30, 28, 28, 0xe94560);
    this.physics.add.existing(enemy);
    enemy.body.setVelocityY(120 + this.wave * 15);
    enemy.enemyType = 'standard';
    enemy.hp = 1;
    enemy.points = 10;
  } else if (enemyType === 1) {
    // Fast enemy — orange diamond shape (rotated square), zigzags
    enemy = this.add.rectangle(x, -30, 22, 22, 0xf97316);
    enemy.setAngle(45);
    this.physics.add.existing(enemy);
    enemy.body.setVelocityY(80 + this.wave * 10);
    enemy.body.setVelocityX(Phaser.Math.Between(-100, 100));
    enemy.enemyType = 'fast';
    enemy.hp = 1;
    enemy.points = 15;
  } else {
    // Tank enemy — larger purple, slower, shoots, more HP
    enemy = this.add.rectangle(x, -30, 36, 36, 0xa855f7);
    this.physics.add.existing(enemy);
    enemy.body.setVelocityY(60 + this.wave * 8);
    enemy.enemyType = 'tank';
    enemy.hp = 3;
    enemy.points = 30;

    // Tank shoots at player
    this.time.delayedCall(Phaser.Math.Between(500, 1500), function () {
      if (enemy.active) {
        this.enemyShoot(enemy);
      }
    }, [], this);
  }

  enemy.body.setAllowGravity(false);
  enemy.setDepth(3);
  this.enemies.add(enemy);
};

// --- ENEMY SHOOT ---
GameScene.prototype.enemyShoot = function (enemy) {
  if (!enemy.active || this.isGameOver) return;

  var bullet = this.enemyBullets.getFirstDead(true, enemy.x, enemy.y + 20, null, null, true);
  if (!bullet) {
    bullet = this.add.rectangle(enemy.x, enemy.y + 20, 4, 10, 0xe94560);
    this.physics.add.existing(bullet);
    bullet.body.setAllowGravity(false);
    this.enemyBullets.add(bullet);
  }
  bullet.setPosition(enemy.x, enemy.y + 20);
  bullet.setActive(true);
  bullet.setVisible(true);
  bullet.body.setVelocityY(250);
};

// --- BULLET HITS ENEMY (agent: modify explosion, scoring) ---
GameScene.prototype.bulletHitEnemy = function (bullet, enemy) {
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();

  enemy.hp -= 1;

  if (enemy.hp <= 0) {
    this.createExplosion(enemy.x, enemy.y, enemy.fillColor);
    this.score += enemy.points;
    this.scoreText.setText('Score: ' + this.score);

    enemy.setActive(false);
    enemy.setVisible(false);
    enemy.body.stop();

    // Wave progression
    this.enemiesKilled += 1;
    if (this.enemiesKilled >= this.enemiesPerWave) {
      this.nextWave();
    }
  } else {
    // Flash white briefly
    enemy.setFillStyle(0xffffff);
    this.time.delayedCall(60, function () {
      if (enemy.active) {
        if (enemy.enemyType === 'tank') enemy.setFillStyle(0xa855f7);
        else enemy.setFillStyle(0xe94560);
      }
    });
  }
};

// --- PLAYER HIT BY ENEMY ---
GameScene.prototype.playerHitEnemy = function (player, enemy) {
  if (this.invincible) return;

  this.createExplosion(enemy.x, enemy.y, 0xe94560);
  enemy.setActive(false);
  enemy.setVisible(false);
  enemy.body.stop();

  this.loseLife();
};

// --- PLAYER HIT BY BULLET ---
GameScene.prototype.playerHitBullet = function (player, bullet) {
  if (this.invincible) return;

  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();

  this.loseLife();
};

// --- LOSE LIFE ---
GameScene.prototype.loseLife = function () {
  this.lives -= 1;
  this.livesText.setText('Lives: ' + this.lives);

  if (this.lives <= 0) {
    this.gameOver();
    return;
  }

  // Brief invincibility
  this.invincible = true;
  this.player.setAlpha(0.4);
  this.cameras.main.shake(150, 0.02);

  this.time.delayedCall(1500, function () {
    this.invincible = false;
    this.player.setAlpha(1);
  }, [], this);
};

// --- WAVE PROGRESSION (agent: adjust difficulty scaling) ---
GameScene.prototype.nextWave = function () {
  this.wave += 1;
  this.waveText.setText('Wave: ' + this.wave);
  this.enemiesKilled = 0;
  this.enemiesPerWave += 3;

  // Increase spawn rate
  this.enemySpawnTimer.delay = Math.max(400, 1200 - this.wave * 100);

  // Wave announcement
  var waveAnnounce = this.add.text(400, 300, 'WAVE ' + this.wave, {
    fontFamily: 'monospace',
    fontSize: '36px',
    color: '#a855f7',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(20).setAlpha(0);

  this.tweens.add({
    targets: waveAnnounce,
    alpha: 1,
    duration: 300,
    yoyo: true,
    hold: 800,
    onComplete: function () { waveAnnounce.destroy(); }
  });
};

// --- EXPLOSION EFFECT (agent: modify particle count, colors) ---
GameScene.prototype.createExplosion = function (x, y, color) {
  for (let i = 0; i < 8; i++) {
    var part = this.add.circle(
      x + Phaser.Math.Between(-5, 5),
      y + Phaser.Math.Between(-5, 5),
      Phaser.Math.Between(2, 5),
      color
    );
    part.setDepth(8);
    part.life = 20;
    part.maxLife = 20;
    this.physics.add.existing(part);
    part.body.setVelocity(
      Phaser.Math.Between(-150, 150),
      Phaser.Math.Between(-150, 150)
    );
    part.body.setAllowGravity(false);
    this.explosionParts.push(part);
  }
};

GameScene.prototype.gameOver = function () {
  this.isGameOver = true;
  this.player.body.setVelocity(0, 0);
  this.enemySpawnTimer.remove();

  this.createExplosion(this.player.x, this.player.y, 0x22d3ee);
  this.player.setVisible(false);
  this.engineGlow.setVisible(false);

  this.add.text(400, 280, 'GAME OVER', {
    fontFamily: 'monospace',
    fontSize: '40px',
    color: '#e94560',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(20);

  this.add.text(400, 330, 'Score: ' + this.score + '  |  Wave: ' + this.wave, {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(20);

  this.add.text(400, 370, 'Click to restart', {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#737373',
    stroke: '#000000',
    strokeThickness: 2
  }).setOrigin(0.5).setDepth(20);

  this.input.once('pointerdown', function () {
    this.isGameOver = false;
    this.scene.restart();
  }, this);
};

// --- START GAME ---
const game = new Phaser.Game(config);

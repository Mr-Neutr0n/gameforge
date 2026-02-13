// ============================================================
// GameForge Preset: Puzzle
// A grid-based match-3 style puzzle game. Click tiles to
// select, match adjacent same-colored groups of 3+ to clear.
// Chain reactions, scoring, and a move counter.
// ============================================================

// --- GAME CONFIGURATION (agent: adjust dimensions) ---
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#0c0c1e',
  scene: [GameScene]
};

// --- MAIN GAME SCENE ---
function GameScene() {
  Phaser.Scene.call(this, { key: 'GameScene' });
}

GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.create = function () {
  // --- GRID CONFIGURATION (agent: adjust grid size, tile size, colors) ---
  this.gridCols = 8;
  this.gridRows = 8;
  this.tileSize = 56;
  this.gridOffsetX = (800 - this.gridCols * this.tileSize) / 2;
  this.gridOffsetY = 80;

  // Tile colors — each index is a tile type
  this.tileColors = [
    0x22d3ee,  // cyan
    0xa855f7,  // purple
    0xe94560,  // red
    0x3b82f6,  // blue
    0x22c55e   // green
  ];

  // --- STATE ---
  this.grid = [];         // 2D array of tile type indices
  this.tileSprites = [];  // 2D array of Phaser game objects
  this.selectedTile = null;
  this.isProcessing = false;
  this.score = 0;
  this.moves = 0;
  this.targetScore = 500;

  // --- INITIALIZE GRID ---
  this.initGrid();

  // --- UI ---
  // Score
  this.scoreText = this.add.text(16, 16, 'Score: 0', {
    fontFamily: 'monospace',
    fontSize: '22px',
    color: '#22d3ee',
    stroke: '#000000',
    strokeThickness: 3
  }).setDepth(10);

  // Target
  this.add.text(16, 46, 'Target: ' + this.targetScore, {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#737373',
    stroke: '#000000',
    strokeThickness: 2
  }).setDepth(10);

  // Moves
  this.movesText = this.add.text(800 - 16, 16, 'Moves: 0', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#a855f7',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(1, 0).setDepth(10);

  // Instruction
  this.add.text(400, 580, 'Click groups of 3+ matching tiles to clear them', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#555555'
  }).setOrigin(0.5).setDepth(10);

  // --- INPUT ---
  this.input.on('pointerdown', this.handleClick, this);
};

GameScene.prototype.update = function () {
  // Subtle idle animation on tiles
  if (this.isProcessing) return;

  var time = this.time.now;
  for (var row = 0; row < this.gridRows; row++) {
    for (var col = 0; col < this.gridCols; col++) {
      var sprite = this.tileSprites[row][col];
      if (sprite) {
        var offset = Math.sin(time * 0.003 + row * 0.5 + col * 0.3) * 1;
        sprite.y = this.gridOffsetY + row * this.tileSize + this.tileSize / 2 + offset;
      }
    }
  }
};

// --- GRID INITIALIZATION (agent: modify to change starting layout) ---
GameScene.prototype.initGrid = function () {
  // Clear existing sprites
  for (var r = 0; r < this.tileSprites.length; r++) {
    for (var c = 0; c < (this.tileSprites[r] || []).length; c++) {
      if (this.tileSprites[r][c]) this.tileSprites[r][c].destroy();
    }
  }

  this.grid = [];
  this.tileSprites = [];

  for (var row = 0; row < this.gridRows; row++) {
    this.grid[row] = [];
    this.tileSprites[row] = [];
    for (var col = 0; col < this.gridCols; col++) {
      // Ensure no initial matches of 3 in a row/column
      var type;
      do {
        type = Phaser.Math.Between(0, this.tileColors.length - 1);
      } while (this.wouldMatch(row, col, type));

      this.grid[row][col] = type;
      this.tileSprites[row][col] = this.createTileSprite(row, col, type);
    }
  }
};

// Check if placing type at (row,col) would create a match during init
GameScene.prototype.wouldMatch = function (row, col, type) {
  // Check horizontal
  if (col >= 2 &&
      this.grid[row][col - 1] === type &&
      this.grid[row][col - 2] === type) {
    return true;
  }
  // Check vertical
  if (row >= 2 &&
      this.grid[row - 1] !== undefined && this.grid[row - 1][col] === type &&
      this.grid[row - 2] !== undefined && this.grid[row - 2][col] === type) {
    return true;
  }
  return false;
};

// --- CREATE TILE SPRITE (agent: modify tile appearance) ---
GameScene.prototype.createTileSprite = function (row, col, type) {
  var x = this.gridOffsetX + col * this.tileSize + this.tileSize / 2;
  var y = this.gridOffsetY + row * this.tileSize + this.tileSize / 2;
  var size = this.tileSize - 6;
  var color = this.tileColors[type];

  // Tile background
  var tile = this.add.rectangle(x, y, size, size, color, 0.85);
  tile.setStrokeStyle(2, color, 1);
  tile.setDepth(2);

  // Inner highlight
  this.add.rectangle(x, y - 2, size - 10, size - 10, color, 0.3).setDepth(3);

  tile.gridRow = row;
  tile.gridCol = col;
  tile.tileType = type;

  return tile;
};

// --- HANDLE CLICK (agent: modify selection behavior) ---
GameScene.prototype.handleClick = function (pointer) {
  if (this.isProcessing) return;

  // Convert pointer to grid coordinates
  var col = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
  var row = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);

  // Bounds check
  if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) return;
  if (this.grid[row][col] === -1) return;

  // Find connected group of same type
  var type = this.grid[row][col];
  var group = this.findConnectedGroup(row, col, type);

  // Need at least 3 to clear
  if (group.length < 3) {
    // Flash the tile to indicate invalid selection
    var sprite = this.tileSprites[row][col];
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 80,
        yoyo: true
      });
    }
    return;
  }

  // Valid match — clear the group
  this.isProcessing = true;
  this.moves += 1;
  this.movesText.setText('Moves: ' + this.moves);

  this.clearGroup(group);
};

// --- FIND CONNECTED GROUP via flood fill ---
GameScene.prototype.findConnectedGroup = function (startRow, startCol, type) {
  var visited = {};
  var group = [];
  var stack = [{ r: startRow, c: startCol }];

  while (stack.length > 0) {
    var cell = stack.pop();
    var key = cell.r + ',' + cell.c;

    if (visited[key]) continue;
    if (cell.r < 0 || cell.r >= this.gridRows) continue;
    if (cell.c < 0 || cell.c >= this.gridCols) continue;
    if (this.grid[cell.r][cell.c] !== type) continue;

    visited[key] = true;
    group.push({ r: cell.r, c: cell.c });

    // Check 4 neighbors
    stack.push({ r: cell.r - 1, c: cell.c });
    stack.push({ r: cell.r + 1, c: cell.c });
    stack.push({ r: cell.r, c: cell.c - 1 });
    stack.push({ r: cell.r, c: cell.c + 1 });
  }

  return group;
};

// --- CLEAR GROUP with animation (agent: modify scoring, effects) ---
GameScene.prototype.clearGroup = function (group) {
  var scene = this;
  var points = group.length * 10 + (group.length > 5 ? (group.length - 5) * 5 : 0);
  this.score += points;
  this.scoreText.setText('Score: ' + this.score);

  // Show floating score
  var centerR = 0;
  var centerC = 0;
  group.forEach(function (cell) {
    centerR += cell.r;
    centerC += cell.c;
  });
  centerR /= group.length;
  centerC /= group.length;
  var floatX = this.gridOffsetX + centerC * this.tileSize + this.tileSize / 2;
  var floatY = this.gridOffsetY + centerR * this.tileSize + this.tileSize / 2;

  var floatingScore = this.add.text(floatX, floatY, '+' + points, {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(20);

  this.tweens.add({
    targets: floatingScore,
    y: floatY - 40,
    alpha: 0,
    duration: 600,
    onComplete: function () { floatingScore.destroy(); }
  });

  // Animate tile removal
  var completed = 0;
  group.forEach(function (cell) {
    var sprite = scene.tileSprites[cell.r][cell.c];
    if (sprite) {
      scene.tweens.add({
        targets: sprite,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 200,
        delay: Phaser.Math.Between(0, 100),
        onComplete: function () {
          sprite.destroy();
          scene.tileSprites[cell.r][cell.c] = null;
          scene.grid[cell.r][cell.c] = -1;

          completed++;
          if (completed === group.length) {
            // All tiles removed — drop and refill
            scene.time.delayedCall(100, function () {
              scene.dropTiles();
              scene.time.delayedCall(300, function () {
                scene.refillGrid();
                scene.time.delayedCall(300, function () {
                  scene.checkWin();
                  scene.isProcessing = false;
                });
              });
            });
          }
        }
      });
    }
  });

  // Camera effect
  this.cameras.main.flash(80, 34, 211, 238, true);
};

// --- DROP TILES (gravity — tiles fall to fill gaps) ---
GameScene.prototype.dropTiles = function () {
  for (var col = 0; col < this.gridCols; col++) {
    var emptyRow = this.gridRows - 1;

    for (var row = this.gridRows - 1; row >= 0; row--) {
      if (this.grid[row][col] !== -1) {
        if (row !== emptyRow) {
          // Move tile down
          this.grid[emptyRow][col] = this.grid[row][col];
          this.grid[row][col] = -1;

          // Move sprite
          var sprite = this.tileSprites[row][col];
          this.tileSprites[emptyRow][col] = sprite;
          this.tileSprites[row][col] = null;

          if (sprite) {
            sprite.gridRow = emptyRow;
            var targetY = this.gridOffsetY + emptyRow * this.tileSize + this.tileSize / 2;
            this.tweens.add({
              targets: sprite,
              y: targetY,
              duration: 150,
              ease: 'Bounce.easeOut'
            });
          }
        }
        emptyRow--;
      }
    }
  }
};

// --- REFILL GRID (add new tiles from top) ---
GameScene.prototype.refillGrid = function () {
  for (var col = 0; col < this.gridCols; col++) {
    for (var row = 0; row < this.gridRows; row++) {
      if (this.grid[row][col] === -1) {
        var type = Phaser.Math.Between(0, this.tileColors.length - 1);
        this.grid[row][col] = type;

        var sprite = this.createTileSprite(row, col, type);
        // Animate in from top
        sprite.y = this.gridOffsetY - this.tileSize;
        sprite.setAlpha(0);
        sprite.setScale(0.5);

        var targetY = this.gridOffsetY + row * this.tileSize + this.tileSize / 2;
        this.tweens.add({
          targets: sprite,
          y: targetY,
          alpha: 0.85,
          scaleX: 1,
          scaleY: 1,
          duration: 250,
          delay: col * 30,
          ease: 'Back.easeOut'
        });

        this.tileSprites[row][col] = sprite;
      }
    }
  }
};

// --- CHECK WIN CONDITION (agent: adjust target score) ---
GameScene.prototype.checkWin = function () {
  if (this.score >= this.targetScore) {
    this.winGame();
    return;
  }

  // Check if any valid moves remain
  var hasValidMove = false;
  for (var row = 0; row < this.gridRows && !hasValidMove; row++) {
    for (var col = 0; col < this.gridCols && !hasValidMove; col++) {
      var type = this.grid[row][col];
      if (type === -1) continue;
      var group = this.findConnectedGroup(row, col, type);
      if (group.length >= 3) {
        hasValidMove = true;
      }
    }
  }

  if (!hasValidMove) {
    // Reshuffle the board
    this.shuffleBoard();
  }
};

// --- SHUFFLE BOARD (when no moves available) ---
GameScene.prototype.shuffleBoard = function () {
  var shuffleText = this.add.text(400, 300, 'SHUFFLING...', {
    fontFamily: 'monospace',
    fontSize: '24px',
    color: '#a855f7',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(30);

  this.time.delayedCall(600, function () {
    shuffleText.destroy();
    this.initGrid();
  }, [], this);
};

GameScene.prototype.winGame = function () {
  this.isProcessing = true;

  this.add.rectangle(400, 300, 400, 200, 0x000000, 0.85).setDepth(25);

  this.add.text(400, 270, 'LEVEL COMPLETE!', {
    fontFamily: 'monospace',
    fontSize: '28px',
    color: '#22d3ee',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(30);

  this.add.text(400, 310, 'Score: ' + this.score + '  |  Moves: ' + this.moves, {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(30);

  this.add.text(400, 345, 'Click to play again', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#737373'
  }).setOrigin(0.5).setDepth(30);

  this.input.once('pointerdown', function () {
    this.isProcessing = false;
    this.scene.restart();
  }, this);
};

// --- START GAME ---
const game = new Phaser.Game(config);

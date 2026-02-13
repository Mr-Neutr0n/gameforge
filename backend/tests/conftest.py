"""Shared test fixtures for GameForge integration tests.

Sets up an in-memory SQLite database, a TestClient for FastAPI, and helper
functions for creating authenticated users and games.
"""

import os

# Set test environment variables BEFORE any app imports.
# DATABASE_URL must remain a postgresql:// URL so app/database.py can create
# its engine without crashing (pool_size / max_overflow are pg-only args).
# Tests use their own in-memory SQLite engine and override get_db().
os.environ.setdefault(
    "DATABASE_URL", "postgresql://test:test@localhost:5432/gameforge_test"
)
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only-32bytes"
os.environ["GOOGLE_API_KEY"] = "test-api-key"
os.environ["FRONTEND_URL"] = "http://localhost:3000"
os.environ["ENVIRONMENT"] = "test"

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Register a compilation hook: when SQLite encounters JSONB, compile it as JSON
@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


from app.database import Base, get_db
from app.auth import create_jwt_token
from app.models import User, Game


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# Enable foreign keys for SQLite
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Yield a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Create a FastAPI TestClient with the test database injected.

    Replaces the app's lifespan so we don't connect to the production
    database during tests. Tables are managed by the setup_database fixture.
    """
    from contextlib import asynccontextmanager
    from fastapi.testclient import TestClient
    from app.main import app

    @asynccontextmanager
    async def _test_lifespan(_app):
        yield

    # Swap lifespan to avoid production DB connection
    original_router_lifespan = app.router.lifespan_context
    app.router.lifespan_context = _test_lifespan

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    app.router.lifespan_context = original_router_lifespan


@pytest.fixture
def test_user(db) -> User:
    """Create and return a test user."""
    user = User(
        email="testuser@example.com",
        name="Test User",
        avatar_url=None,
        provider="github",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user) -> dict:
    """Return authorization headers with a valid JWT for the test user."""
    token = create_jwt_token(test_user.id, test_user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_game(db, test_user) -> Game:
    """Create and return a test game record (no game_code yet)."""
    game = Game(
        user_id=test_user.id,
        prompt="a simple platformer where a blue square jumps on green platforms",
        title=None,
        description=None,
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


# ── Sample game code for testing audits and iteration ──────────────────

SAMPLE_PLATFORMER_CODE = """\
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // No external assets — all graphics drawn in code
    }

    create() {
        this.scene.start('GameScene');
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
    }

    preload() {
        // Generate textures using graphics
    }

    create() {
        // Background
        this.cameras.main.setBackgroundColor('#87CEEB');

        // Create player texture (blue square)
        const playerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        playerGraphics.fillStyle(0x3b82f6, 1);
        playerGraphics.fillRect(0, 0, 32, 32);
        playerGraphics.generateTexture('player', 32, 32);
        playerGraphics.destroy();

        // Create platform texture (green rectangle)
        const platformGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        platformGraphics.fillStyle(0x22c55e, 1);
        platformGraphics.fillRect(0, 0, 200, 20);
        platformGraphics.generateTexture('platform', 200, 20);
        platformGraphics.destroy();

        // Platforms group
        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(400, 568, 'platform').setScale(4).refreshBody();
        this.platforms.create(600, 400, 'platform');
        this.platforms.create(50, 250, 'platform');
        this.platforms.create(750, 220, 'platform');

        // Player
        this.player = this.physics.add.sprite(100, 450, 'player');
        this.player.setBounce(0.2);
        this.player.setCollideWorldBounds(true);

        // Collider
        this.physics.add.collider(this.player, this.platforms);

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();

        // Score text
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fill: '#000'
        });

        // Camera follow
        this.cameras.main.startFollow(this.player);
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

    destroy() {
        // Cleanup
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 },
            debug: false
        }
    },
    scene: [BootScene, GameScene]
};

const game = new Phaser.Game(config);
"""

SAMPLE_ITERATED_CODE = SAMPLE_PLATFORMER_CODE.replace(
    "playerGraphics.fillStyle(0x3b82f6, 1);",
    "playerGraphics.fillStyle(0xff0000, 1);",
).replace(
    "// Create player texture (blue square)",
    "// Create player texture (red square)",
)

import json
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Monkey-patch the default JSON encoder to handle bytes objects.
# ADK's internal telemetry (trace_call_llm) calls json.dumps() on LLM
# request/response objects that may contain bytes from Gemini, causing
# "Object of type bytes is not JSON serializable". This fixes it globally.
_original_default = json.JSONEncoder.default

def _patched_default(self, o):
    if isinstance(o, bytes):
        return o.decode("utf-8", errors="replace")
    if isinstance(o, set):
        return list(o)
    return _original_default(self, o)

json.JSONEncoder.default = _patched_default
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

load_dotenv()

from app.database import Base, engine  # noqa: E402
import app.models  # noqa: E402, F401 — register models with Base.metadata
from app.rate_limit import limiter  # noqa: E402
from app.routes.auth import router as auth_router  # noqa: E402
from app.routes.games import router as games_router  # noqa: E402
from app.routes.generate import router as generate_router  # noqa: E402
from app.routes.audit import router as audit_router  # noqa: E402

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="GameForge API",
    description="AI-powered game generation backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
allowed_origins = [FRONTEND_URL]
if ENVIRONMENT == "development":
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Routers
app.include_router(auth_router)
app.include_router(games_router)
app.include_router(generate_router)
app.include_router(audit_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "gameforge-api"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

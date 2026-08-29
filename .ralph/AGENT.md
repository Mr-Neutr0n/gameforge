# Game Builder — Agent Instructions

## Project Overview
Game Builder is an AI-powered game builder. Users describe a game in natural language, and a multi-agent system (built on Google ADK with Gemini 2.5 Flash) generates a playable Phaser.js browser game. Games are shareable via public URLs. Recently renamed from "GameForge" to "Game Builder".

## Workspace Contents
```
lovable-for-games/
├── frontend/          → Next.js 15 (Vercel) — app router, Tailwind 4, NextAuth
│   ├── src/app/       # Pages: /, /create, /dashboard, /workspace/[id], /game/[id], /not-found
│   ├── src/components/# React components (GamePreview, ActivityFeed, AppLayout, etc.)
│   ├── src/lib/       # API client (api.ts), auth helpers (auth.ts)
│   ├── public/        # Favicons, OG image, llms.txt
│   └── e2e/           # Playwright E2E tests (being created)
├── backend/           → FastAPI (shared EC2) — Google ADK agents, PostgreSQL
│   ├── app/main.py    # FastAPI app entry, CORS, rate limiting
│   ├── app/models.py  # SQLAlchemy models: User, Game, Conversation, AuditResult
│   ├── app/auth.py    # JWT + OAuth (Google, GitHub)
│   ├── app/database.py# SQLAlchemy engine config
│   ├── app/agents/    # Google ADK agents (planner, generator, validator, fixer, iterator, coordinator, runner, tools)
│   ├── app/audits/    # Logic, UI, code quality audits + orchestrator
│   ├── app/routes/    # Route files: games.py, generate.py, auth.py, audit.py
│   └── tests/         # pytest tests: conftest.py, test_full_flow.py
├── .ralph/            # Ralph autonomous loop config
└── notes.md           # Project notes
```

## Build / Run Commands
- Frontend build: `cd frontend && npm run build`
- Frontend dev: `cd frontend && npm run dev`
- Frontend E2E tests: `cd frontend && npx playwright test`
- Backend import check: `cd backend && python -c "from app.main import app; print('OK')"`
- Backend tests: `cd backend && python -m pytest tests/ -v`
- Backend dev: `cd backend && uvicorn app.main:app --reload`

## Patterns & Conventions
- Frontend: TypeScript strict, absolute imports (`@/components/...`), "use client" where needed
- Backend: Python 3.11+, type hints, Pydantic models for request/response
- ADK agents: Google ADK patterns — `LlmAgent`, `SequentialAgent`, `LoopAgent`, `ToolContext`
- Git commits: `TASK-XXX: short description` (no Co-Authored-By)
- Design: Warm minimal dark theme with teal accent (#5eead4), no neon/arcade aesthetics
- Backend tests use in-memory SQLite via conftest.py fixtures

# GameForge — Agent Instructions

## Project Overview
GameForge is an AI-powered game builder. Users describe a game in natural language, and a multi-agent system (built on Google ADK) generates a playable Phaser.js browser game. The agent works autonomously — planning, generating, validating, and fixing — while the user watches in real-time via SSE streaming. Games are shareable via public URLs.

## Workspace Contents
```
lovable-for-games/
├── frontend/          → Next.js (Vercel) — app router, Tailwind, NextAuth
│   ├── src/app/       # Pages and layouts
│   ├── src/components/# React components
│   └── src/lib/       # API client, auth helpers
├── backend/           → FastAPI (Railway) — Google ADK agents, endpoints
│   ├── app/main.py    # FastAPI app entry
│   ├── app/models.py  # SQLAlchemy models
│   ├── app/auth.py    # JWT + OAuth
│   ├── app/agents/    # Google ADK agents (planner, generator, validator, fixer, iterator, coordinator)
│   ├── app/templates/ # Phaser.js game templates
│   ├── app/audits/    # Logic, UI, code quality audits
│   └── app/routes/    # Additional route files
├── .ralph/            # Ralph autonomous loop config
└── notes.md           # Project notes
```

## Build / Run Commands
- Frontend build: `cd frontend && npm run build`
- Backend import check: `cd backend && python -c "from app.main import app; print('OK')"`
- Backend tests: `cd backend && pytest`
- Full frontend dev: `cd frontend && npm run dev`
- Full backend dev: `cd backend && uvicorn app.main:app --reload`

## Patterns & Conventions
- Frontend: TypeScript, absolute imports (`@/components/...`), "use client" where needed
- Backend: Python 3.11+, type hints, Pydantic models for request/response
- ADK agents: Follow Google ADK patterns — `LlmAgent`, `SequentialAgent`, `LoopAgent`, `ToolContext`
- Git commits: `TASK-XXX: short description`
- No Co-Authored-By lines
- Dark theme UI matching the design system in PROMPT.md

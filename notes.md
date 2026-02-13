# GameForge — Notes

## Status

Building. Ralph autonomous loop.

## Architecture

Multi-agent game builder using Google ADK:
- **Frontend:** Next.js + Tailwind + NextAuth → Vercel
- **Backend:** FastAPI + Google ADK + Gemini 2.5 Flash → Railway
- **DB:** Railway PostgreSQL
- **Game runtime:** Sandboxed iframe with Phaser 3 CDN
- **Domain:** games.harikp.com

## Agent System (Google ADK)

- Coordinator → SequentialAgent orchestrating:
  - Planner → breaks prompt into game design doc
  - Generator → writes Phaser.js code
  - Validator → checks code quality
  - Fixer (LoopAgent, max 3) → fixes validation errors
- Iterator → handles user feedback post-generation
- All stream via SSE to frontend activity feed

## Audit Pipeline

- Logic audit: scene exists, game loop, input handlers, no crashes
- UI audit: valid dimensions, colors, font sizes, viewport
- Code quality: no eval, no var, proper lifecycle, no DOM access outside Phaser

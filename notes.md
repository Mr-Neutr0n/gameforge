# GameForge - Notes

## Status

Building. Shared-EC2 deployment files are prepared in the repository. No deployment has been performed or verified on the host.

## Architecture

Multi-agent game builder using Google ADK:
- **Frontend:** Next.js + Tailwind + NextAuth on Vercel at `games.harikp.com`
- **Backend:** FastAPI + Google ADK + Gemini 2.5 Flash on the shared Ubuntu EC2 host at `api.games.harikp.com`
- **DB:** Dedicated local PostgreSQL database and role on the shared EC2 host
- **Game runtime:** Sandboxed iframe with Phaser 3 CDN

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

## Deployment checklist

- [ ] Confirm EC2 capacity, security-group rules, public address, and DNS prerequisites.
- [ ] Create the dedicated `gameforge` Unix user and `/opt/sideprojects/gameforge` release directories.
- [ ] Create the separate local PostgreSQL `gameforge` role and database with a generated password.
- [ ] Create `/etc/gameforge/gameforge.env` with production secrets and mode `0640`.
- [ ] Stage an immutable release with its own Python virtual environment.
- [ ] Install and start `deploy/systemd/gameforge.service` on localhost port 8102.
- [ ] Install the Nginx site and confirm SSE responses stream without buffering.
- [ ] Issue and test the `api.games.harikp.com` TLS certificate with Certbot.
- [ ] Update Google and GitHub callbacks for `games.harikp.com`.
- [ ] Verify local and public `/api/health` and `/api/ready` responses.
- [ ] Test Google and GitHub sign-in, game generation, and iteration through the production frontend.
- [ ] Schedule `pg_dump` backups, copy them off-host, and complete a restore test.

See `DEPLOYMENT.md` for commands, rollback, logs, and backup procedures.

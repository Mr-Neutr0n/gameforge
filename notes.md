# GameForge - Notes

## Status

Building. Shared-EC2 deployment files are prepared in the repository. No deployment has been performed or verified on the host.

## Architecture

- **Frontend:** Next.js + Tailwind + NextAuth on Vercel at `games.harikp.com`
- **Backend:** FastAPI + Azure OpenAI GPT on the shared Ubuntu EC2 host at `api.games.harikp.com`
- **DB:** Dedicated local PostgreSQL database and role on the shared EC2 host
- **Game runtime:** Sandboxed iframe with Phaser 3 CDN

## Generation pipeline

- Planner creates a structured game design.
- Generator writes complete Phaser.js code.
- Local validation checks required structure and blocks modules and remote assets.
- One GPT repair pass runs only when structural validation fails.
- Iterator applies user feedback to existing games.
- Progress streams to the frontend over SSE.
- PostgreSQL atomically enforces 100 generation or iteration attempts globally and 2 per authenticated user per UTC day.

## Audit pipeline

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
- [ ] Test Google and GitHub sign-in, game generation, iteration, and quota responses through the production frontend.
- [ ] Schedule `pg_dump` backups, copy them off-host, and complete a restore test.

See `DEPLOYMENT.md` for commands, rollback, logs, and backup procedures.

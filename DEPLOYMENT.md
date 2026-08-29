# Shared EC2 deployment

GameForge runs its FastAPI backend on the shared Ubuntu EC2 host. Nginx terminates TLS for `api.games.harikp.com` and proxies to Uvicorn on `127.0.0.1:8102`. The frontend remains at `https://games.harikp.com`.

This repository does not create AWS resources, DNS records, OAuth applications, or secrets. Prepare these external prerequisites first:

- An Ubuntu EC2 host with a stable public address and enough capacity for GameForge alongside the other services.
- Security-group access for TCP 80 and 443, plus restricted administrative access for SSH.
- An `A` or `AAAA` record for `api.games.harikp.com` pointing to the host.
- The frontend deployment at `games.harikp.com`.
- Production JWT, OAuth, Azure OpenAI, and database secrets. Do not store them in Git.

## Bootstrap the host

Install packages without changing the configuration of other hosted applications:

```bash
sudo apt update
sudo apt install python3-venv python3-pip postgresql nginx certbot python3-certbot-nginx git
```

Create a dedicated service account and directories:

```bash
sudo adduser --system --group --home /var/lib/gameforge gameforge
sudo install -d -o gameforge -g gameforge -m 0750 /var/lib/gameforge
sudo install -d -o root -g gameforge -m 0750 /opt/sideprojects/gameforge
sudo install -d -o root -g gameforge -m 0750 /opt/sideprojects/gameforge/releases
sudo install -d -o root -g gameforge -m 0750 /etc/gameforge
```

The service account must not have sudo access or share a home directory with another application.

## Create the PostgreSQL role and database

Create the role with an interactive password prompt so the password does not enter shell or PostgreSQL history. The role owns only the GameForge database.

```bash
sudo -u postgres createuser --pwprompt gameforge
sudo -u postgres createdb --owner=gameforge gameforge
sudo -u postgres psql --command='REVOKE CONNECT ON DATABASE gameforge FROM PUBLIC; GRANT CONNECT ON DATABASE gameforge TO gameforge;'
sudo -u postgres psql --dbname=gameforge --command='REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT ALL ON SCHEMA public TO gameforge;'
```

Keep PostgreSQL bound to localhost unless another local service already requires a different setting. Test the new login before deployment:

```bash
psql 'postgresql://gameforge:replace-with-database-password@127.0.0.1:5432/gameforge' -c 'SELECT 1;'
```

URL-encode the password in `DATABASE_URL` if it contains reserved URL characters.

## Create the environment file

Create `/etc/gameforge/gameforge.env` from `backend/.env.example`. Replace every placeholder and keep the file outside the release tree.

```bash
sudoedit /etc/gameforge/gameforge.env
sudo chown root:gameforge /etc/gameforge/gameforge.env
sudo chmod 0640 /etc/gameforge/gameforge.env
```

Use `FRONTEND_URL=https://games.harikp.com`, `ENVIRONMENT=production`, `AZURE_MODEL_TEXT=gpt-5-6-luna`, `GLOBAL_GENERATIONS_PER_DAY=100`, and `USER_GENERATIONS_PER_DAY=2`. The Azure endpoint and key must belong to the approved Azure OpenAI resource. The public API hostname belongs in the frontend's `NEXT_PUBLIC_API_URL=https://api.games.harikp.com`; the backend does not read that frontend variable.

Generation and iteration share PostgreSQL-backed UTC-day quotas. They allow 100 accepted attempts globally and 2 per authenticated user. The transaction takes a PostgreSQL advisory lock before checking and incrementing both counters, so restarts and concurrent requests cannot bypass the limits.

## Build a release artifact

On a trusted operator machine with a clean checkout, archive an exact reviewed commit and copy it to the host:

```bash
REVISION=<full-40-character-commit-sha>
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short "$REVISION")"
git archive --format=tar --output="/tmp/gameforge-${RELEASE_ID}.tar" "$REVISION"
scp "/tmp/gameforge-${RELEASE_ID}.tar" <ubuntu-host>:/tmp/
printf '%s\n' "$RELEASE_ID"
```

On the host, extract and build the release as an administrator. The service account receives read and traversal access but cannot alter releases:

```bash
RELEASE_ID=<release-id>
RELEASE_DIR="/opt/sideprojects/gameforge/releases/$RELEASE_ID"
sudo install -d -o root -g gameforge -m 0750 "$RELEASE_DIR"
sudo tar --extract --file="/tmp/gameforge-${RELEASE_ID}.tar" --directory="$RELEASE_DIR" --no-same-owner
sudo python3 -m venv "$RELEASE_DIR/venv"
sudo "$RELEASE_DIR/venv/bin/pip" install --requirement "$RELEASE_DIR/backend/requirements.txt"
sudo "$RELEASE_DIR/venv/bin/python" -m compileall -q "$RELEASE_DIR/backend/app"
sudo chown -R root:gameforge "$RELEASE_DIR"
sudo chmod -R u=rwX,g=rX,o= "$RELEASE_DIR"
```

On the first deployment only, install the service and Nginx configuration:

```bash
sudo install -o root -g root -m 0644 "$RELEASE_DIR/deploy/systemd/gameforge.service" /etc/systemd/system/gameforge.service
sudo install -o root -g root -m 0644 "$RELEASE_DIR/deploy/nginx/api.games.harikp.com.conf" /etc/nginx/sites-available/api.games.harikp.com.conf
sudo ln -sfn /etc/nginx/sites-available/api.games.harikp.com.conf /etc/nginx/sites-enabled/api.games.harikp.com.conf
sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl reload nginx
```

Certbot modifies the installed Nginx file when TLS is enabled. Do not overwrite that file during routine releases. If the systemd unit changes, review and reinstall only the unit, then run `sudo systemctl daemon-reload`.

Switch the `current` symlink and start the API:

```bash
sudo ln -s "$RELEASE_DIR" "/opt/sideprojects/gameforge/.current-$RELEASE_ID"
sudo mv -Tf "/opt/sideprojects/gameforge/.current-$RELEASE_ID" /opt/sideprojects/gameforge/current
sudo systemctl enable gameforge
sudo systemctl restart gameforge
rm "/tmp/gameforge-${RELEASE_ID}.tar"
```

The application currently creates missing tables during startup. It has no migration framework, so review database compatibility before deploying any future schema change.

## Check liveness and readiness

Liveness confirms that the API process responds. Readiness also executes `SELECT 1` against PostgreSQL.

```bash
curl -fsS http://127.0.0.1:8102/api/health
curl -fsS http://127.0.0.1:8102/api/ready
curl -fsS http://api.games.harikp.com/api/ready
```

A failed readiness check returns HTTP 503 without database error details. Do not route traffic to a release until readiness succeeds.

## Configure OAuth callbacks

Update both OAuth applications when the production frontend hostname is active:

- Google authorized JavaScript origin: `https://games.harikp.com`
- Google redirect URI: `https://games.harikp.com/api/auth/callback/google`
- GitHub authorization callback URL: `https://games.harikp.com/api/auth/callback/github`

The frontend deployment must use the matching client IDs and secrets, a new `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://games.harikp.com`, and `NEXT_PUBLIC_API_URL=https://api.games.harikp.com`. Test one complete sign-in with each provider after changing callbacks. OAuth client secrets belong in Vercel, not the backend environment file.

## Enable TLS

Wait for public DNS to resolve to the EC2 host, then let Certbot update the installed Nginx site:

```bash
sudo certbot --nginx -d api.games.harikp.com --redirect
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status certbot.timer
curl -fsS https://api.games.harikp.com/api/ready
```

The checked-in Nginx file listens on HTTP so Certbot can add its managed TLS directives. It disables proxy buffering and caching so generation and iteration SSE events reach clients as they arrive. The 600-second proxy timeouts exceed the frontend generation timeout.

## Account-placement debt

The shared host, Elastic IP, IAM role, encrypted EBS volume, S3 backups, alarms, and related parameters currently live in AWS Organizations management account `018701996146`. This is temporary architecture debt. Migrate the complete resource set to the intended member account in one planned cutover, then update DNS only after direct readiness checks pass against the replacement host.

## Roll back

Choose a known-good release that is compatible with the current database. Record the active target, switch the symlink, restart, and check readiness:

```bash
readlink -f /opt/sideprojects/gameforge/current
export PREVIOUS_RELEASE=/opt/sideprojects/gameforge/releases/<known-good-release-id>
sudo ln -s "$PREVIOUS_RELEASE" /opt/sideprojects/gameforge/.current-rollback
sudo mv -Tf /opt/sideprojects/gameforge/.current-rollback /opt/sideprojects/gameforge/current
sudo systemctl restart gameforge
curl -fsS http://127.0.0.1:8102/api/ready
```

Do not delete the previous release until the new release has passed application and OAuth checks.

## Back up and test restores

Create PostgreSQL custom-format dumps and copy encrypted backups off the EC2 host. Run the dump from the host's existing scheduler at least daily and apply a documented retention policy.

```bash
sudo install -d -o postgres -g postgres -m 0700 /var/backups/gameforge
export BACKUP_FILE="/var/backups/gameforge/gameforge-$(date -u +%Y%m%d%H%M%S).dump"
sudo -u postgres pg_dump --format=custom --file="$BACKUP_FILE" gameforge
sudo -u postgres pg_restore --list "$BACKUP_FILE"
```

Test a restore regularly in a disposable local database. This does not replace an off-host disaster-recovery test.

```bash
sudo -u postgres createdb gameforge_restore_test
sudo -u postgres pg_restore --dbname=gameforge_restore_test "$BACKUP_FILE"
sudo -u postgres psql gameforge_restore_test -c 'SELECT count(*) FROM users;'
sudo -u postgres dropdb gameforge_restore_test
```

## Logs and operations

```bash
sudo systemctl status gameforge
sudo journalctl -u gameforge -n 200 --no-pager
sudo journalctl -u gameforge -f
sudo tail -n 200 /var/log/nginx/api.games.harikp.com.access.log
sudo tail -n 200 /var/log/nginx/api.games.harikp.com.error.log
sudo journalctl -u postgresql -n 200 --no-pager
```

# Operating Magnet

Use Node 22.16 or newer in the Node 22 line and pnpm 10.26.1. Commands below
use Bash. Inject credentials through environment variables or a secret manager;
the server does not automatically load `.env`. Docker Compose reads `.env`.

`pnpm build:release` builds and packages the relay, web app and mobile web app.
`pnpm start` serves the landing page at `/`, the console at `/console.html`,
mobile web at `/mobile/`, and REST/MCP on the same port. The Docker image
includes all three builds. Static pages contain no conversation data;
the console's API calls require the configured bearer key.

The current artifact is the plaintext conversation relay, not the planned E2EE
messenger. A successful build or template synthesis does not prove live cloud
deployment, native installation or end-to-end encryption.

## Standalone Node release

From the source checkout, run `corepack pnpm build:release` followed by
`corepack pnpm verify:release`. This creates `artifacts/magnet-0.2.0.tgz` and its
`.sha256` sidecar. The verifier checks every manifest checksum and starts the
extracted service outside the checkout without `node_modules`, exercising web,
mobile, REST and MCP. `release-manifest.json` records the source commit and
whether the source tree was dirty; builds from dirty trees are development artifacts.

Extract into a new release directory, preserving your database separately.
There is no dependency-install step. Example for PowerShell:

```powershell
New-Item -ItemType Directory magnet-release
tar -xzf artifacts/magnet-0.2.0.tgz -C magnet-release
Set-Location magnet-release
$env:NODE_ENV = 'production'
$env:HOST = '127.0.0.1'
$env:PORT = '3100'
$env:ALLOWED_HOSTS = 'localhost,127.0.0.1'
$env:ALLOWED_ORIGINS = 'http://localhost:3100'
$env:MAGNET_PUBLIC_BASE_URL = 'http://localhost:3100'
# Inject MAGNET_API_KEY from your secret manager; do not commit it or echo it.
node dist/index.mjs
```

For a public host, use HTTPS at a reverse proxy, the real URL/allowlists and a
persistent `MAGNET_DB_FILE` outside the replaceable release directory. Use
`node scripts/smoke.mjs https://your-host` after rollout. Run backups with
`node scripts/backup-sqlite.mjs <new-backup-path>` and Postgres migrations with
`node dist/magnet/store/migrate.mjs`. The archive contains no Node runtime, keys,
database, dependency tree or native APK/IPA. Keep the previous release and a
verified database backup for rollback; do not blindly roll back across schema changes.

## Fly.io with SQLite

Prerequisites: a Fly account, billing enabled, the [Fly CLI](https://fly.io/docs/flyctl/install/),
Node, and this repository. Choose your organization when creating the app.
This creates one machine and one persistent volume; SQLite cannot share a
volume across machines. These commands incur the host's normal charges.

```bash
set -eu
corepack enable
corepack pnpm install --frozen-lockfile
pnpm build
fly auth login
APP="magnet-$(node -e 'console.log(require("node:crypto").randomBytes(6).toString("hex"))')"
fly apps create "$APP"
fly volumes create lnkz_data --app "$APP" --region iad --size 1 --yes
export MAGNET_API_KEY="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))')"
printf 'MAGNET_API_KEY=%s\nMAGNET_PUBLIC_BASE_URL=https://%s.fly.dev\nALLOWED_HOSTS=%s.fly.dev,localhost,127.0.0.1\nALLOWED_ORIGINS=https://%s.fly.dev\n' "$MAGNET_API_KEY" "$APP" "$APP" "$APP" | fly secrets import --app "$APP" --stage
fly deploy --app "$APP" --ha=false
fly checks list --app "$APP"
pnpm smoke "https://$APP.fly.dev"
pnpm seed "https://$APP.fly.dev"
```

Keep the generated key in your password manager before closing this shell.
Do not enable shell tracing. A repeat deployment uses the same app and volume:
`fly deploy --app "$APP" --ha=false`. Store the app name with your runbook.

The readiness probe sends `Host: localhost:3100`, admitted by the existing
loopback allowlist. Host checks stay enabled for other traffic. Fly's service
checks control routing; they are separate from process liveness. See the
[configuration reference](https://fly.io/docs/reference/configuration/),
[health-check behavior](https://fly.io/docs/reference/health-checks/), and
[secret import command](https://fly.io/docs/flyctl/secrets-import/).

## Configuration reference

Required for public production: set `NODE_ENV=production`, an authentication
source, `HOST=0.0.0.0`, the public URL, and host/origin allowlists. Startup errors
name `MAGNET_API_KEY` or `MAGNET_API_KEYS_JSON` when authentication is missing.

| Variable | Default / behavior when absent |
| --- | --- |
| `NODE_ENV` | Development behavior; set `production` publicly |
| `HOST`, `PORT` | `127.0.0.1`, `3100`; container sets host to `0.0.0.0` |
| `MAGNET_PUBLIC_BASE_URL` | Derived from host/port; set the externally reachable HTTPS origin for handoff links |
| `ALLOWED_HOSTS` | SDK defaults; set comma-separated public names; loopback names are retained for probes |
| `ALLOWED_ORIGINS` | Same-origin requests only; add explicit comma-separated browser origins |
| `MAGNET_API_KEY` | No principal; production refuses startup without this or the JSON principal list |
| `MAGNET_API_KEYS_JSON` | Optional nonempty array of `{key, workspaceId, actorId, scopes}`; replaces the single-key principal |
| `MAGNET_AUTH_MODE` | `static`; `multi-key` requires Postgres and configured principals |
| `MAGNET_DEFAULT_ACTOR_ID` | `system` for the single-key principal |
| `MAGNET_ALLOW_UNAUTHENTICATED` | True outside production, false in production; local use only |
| `MAGNET_MCP_ENABLED`, `MAGNET_MCP_PATH` | `true`, `/mcp` |
| `MAGNET_MCP_API_KEY_REQUIRED` | `false`; when true, requires configured principals; production API auth covers MCP too |
| `MAGNET_MCP_CONTEXT_SECRET` | Forwarding disabled; optional shared secret of at least 32 bytes, see [MCP trust protocol](MCP.md#multi-node-context-forwarding) |
| `MAGNET_DB_FILE` | `.data/magnet.db`; SQLite file, ignored when Postgres is selected |
| `MAGNET_DATA_FILE` | `.data/magnet.json`; legacy import into an empty SQLite database |
| `DATABASE_URL` | SQLite selected when absent, unless split database credentials below are complete |
| `DATABASE_SECRET_JSON`, `DATABASE_HOST` | Optional JSON username/password plus hostname, used only without `DATABASE_URL` |
| `DATABASE_PORT`, `DATABASE_NAME` | `5432`, `magnet` for split database credentials |
| `DATABASE_SSL` | Verified TLS; `false` disables TLS for a local test database only |
| `MAGNET_DATABASE_APP_ROLE` | No grants added by migration; set the existing non-owner application role |
| `MAGNET_POSTGRES_WORKSPACE_ID` | `00000000-0000-4000-8000-000000000001`; default workspace UUID |
| `MAGNET_PG_POOL_MAX` | `8`, bounded to 1–32 connections |
| `MAGNET_PG_IDLE_TIMEOUT_MS` | `30000` |
| `MAGNET_PG_CONNECTION_TIMEOUT_MS` | `5000` |
| `MAGNET_PG_MAX_LIFETIME_SECONDS` | `300` |
| `MAGNET_MAX_BODY` | `24mb` JSON request limit |
| `MAGNET_TRUST_PROXY` | `false`; use a verified hop count only when the proxy overwrites forwarded client headers |
| `MAGNET_RATE_LIMIT_WINDOW_MS` | `60000`, range 1000–86400000 |
| `MAGNET_SHARE_RATE_LIMIT`, `MAGNET_API_RATE_LIMIT` | `60`, `600` per window; zero disables the respective limiter |
| `MAGNET_SHUTDOWN_TIMEOUT_MS` | `10000`, range 1000–120000; Fly uses 25000 below its 30-second stop window |
| `MAGNET_TRANSFER_ALLOW_PRIVATE` | Private-address transfer refused; exact `true` is for local two-instance demos |
| `MAGNET_BASE_URL` | `http://127.0.0.1:3100` for seed/smoke scripts; CLI URL argument wins |
| `WEB_DIST_DIR` | `dist/web` relative to the process working directory; optional override for built web assets |

Optional connectors remain unconfigured until their inputs are complete:

| Variables | Use |
| --- | --- |
| `SLACK_USER_TOKEN` or `SLACK_BOT_TOKEN`; `SLACK_CHANNEL_IDS` | Slack search; bot mode requires channel IDs |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Jira read access |
| `FIGMA_PERSONAL_ACCESS_TOKEN` or `FIGMA_ACCESS_TOKEN`; `FIGMA_FILE_KEYS` | Figma files |
| `DOCUMENT_FEED_URLS`, `DOCUMENT_FEED_BEARER_TOKEN` | Comma-separated document feeds and optional bearer token |
| `FANTASY_MCP_URL`, `FANTASY_MCP_API_KEY` | Optional downstream MCP connection |
| `MAGNET_MCP_TARGETS` | Comma-separated `name=url` or `name=url|key` publish-discovery targets |

## Docker

```bash
cp .env.example .env
node -e 'require("node:fs").appendFileSync(".env", "MAGNET_API_KEY=" + require("node:crypto").randomBytes(32).toString("base64url") + "\n")'
docker compose up --build -d
curl --fail http://localhost:3100/ready
```

The production server refuses to start without `MAGNET_API_KEY` or the configured
JSON principals. Compose binds to loopback by default.
For a trusted LAN demo only, set `MAGNET_BIND_ADDRESS=0.0.0.0`, then configure the
LAN URL and host/origin allowlists. `MAGNET_HOST_PORT` changes the host port.
Do not expose this HTTP port directly to the public internet.

Validate an image before deploying it:

```bash
docker build -t magnet:local .
corepack pnpm verify:container magnet:local
```

The check creates its own container and disposable volume, verifies built assets,
authentication, one-use handoffs and persistence across restart, then removes only
those test resources. It fails if Docker or the image is unavailable. Application
code runs as `magnet`; the entrypoint briefly uses root to initialize volume ownership.
The runtime contains bundled JavaScript and no package-manager install step.

The image downloads Amazon's RDS CA bundle at build time and configures
`NODE_EXTRA_CA_CERTS` for verified database TLS. Rebuild for certificate updates.
For the standalone archive on RDS, obtain the CA bundle separately and set
`NODE_EXTRA_CA_CERTS` before launching Node. Never disable certificate verification
to make an RDS connection succeed. See the [RDS TLS documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).

Set public URL and allowlists in `.env` before exposing it. The entrypoint
initializes ownership of a newly mounted volume, then runs Node as `magnet`.
Terminate TLS at the proxy. Never cache `/api/*`, `/mcp`, or `/share/*`.

## Health, logs and shutdown

- `/health` is liveness: the process responds without querying storage.
- `/ready` runs a store query, returning 200 or 503 within two seconds. It is
  unavailable during shutdown. Both endpoints require an admitted Host header.
- Request stdout is JSON: `method`, route-template `path`, `status`,
  `durationMs`, authenticated `workspace` (null otherwise), and generated
  `requestId`. The response exposes the same ID. Headers, query strings,
  message bodies, arbitrary paths, and handoff tokens are excluded.
- SIGTERM/SIGINT stop accepting connections, drain active responses, then await
  store and rate-limit pool closure. Timeout exits nonzero. Allow the platform
  more time than `MAGNET_SHUTDOWN_TIMEOUT_MS`.

If readiness fails, check disk space, file ownership, database connectivity and
schema version. Do not use readiness as a Kubernetes liveness probe: a database
outage should remove traffic, not create a restart loop. Use `/ready` for an
App Runner HTTP service check. After rollout, run `pnpm smoke "$PUBLIC_URL"`
with the API key in the environment. The script removes its synthetic conversation;
its audit events remain. `pnpm verify:http` exercises local MCP forwarding and stdio.

## Postgres release and tests

Create a separate migration owner and a runtime login without ownership,
superuser or BYPASSRLS privileges. Put their URLs in `MIGRATION_DATABASE_URL`
and `APP_DATABASE_URL` through your secret manager, then run:

```bash
pnpm build
DATABASE_URL="$MIGRATION_DATABASE_URL" MAGNET_DATABASE_APP_ROLE=lnkz_app pnpm db:migrate
DATABASE_URL="$APP_DATABASE_URL" pnpm start
```

The built artifact includes every SQL migration. The server checks the expected
schema before listening and refuses an incompatible version. A Fly Postgres
deployment can run the built migration in its release command, with a separate
migration credential; do not give the web process the migration role. The
SQLite `fly.toml` intentionally has no database release command.

Use dedicated disposable databases for integration tests:

```bash
MAGNET_POSTGRES_MIGRATION_URL="$MIGRATION_DATABASE_URL" MAGNET_POSTGRES_TEST_URL="$APP_DATABASE_URL" MAGNET_DATABASE_APP_ROLE=lnkz_app pnpm test
```

Only for a local non-TLS test server, also set `DATABASE_SSL=false`.

## Backup and restore

SQLite's backup API captures a consistent snapshot including committed WAL
changes. Do not copy only the live `.db` file.

```bash
pnpm db:backup ./magnet-backup.db
node --input-type=module -e 'import {DatabaseSync} from "node:sqlite"; const db=new DatabaseSync("magnet-backup.db",{readOnly:true}); console.log(db.prepare("PRAGMA integrity_check").get()); db.close();'
```

For a Fly volume, run the same backup API inside the machine and download it:

```bash
fly ssh console --app "$APP" --command 'node --input-type=module -e '\''import {DatabaseSync,backup} from "node:sqlite";const db=new DatabaseSync("/app/.data/magnet.db",{readOnly:true});await backup(db,"/tmp/magnet-backup.db");db.close();'\'''
fly ssh sftp get --app "$APP" /tmp/magnet-backup.db ./magnet-backup.db
```

Restore into a new path, with the application stopped. Keep the old database and
its WAL files together until the restored service is verified:

```bash
# Stop pnpm start with Ctrl-C first.
mkdir -p .data/restored
cp ./magnet-backup.db .data/restored/magnet.db
MAGNET_DB_FILE=.data/restored/magnet.db pnpm start
```

For Fly, upload the verified backup under a new filename and select it on
restart; the previous database remains available for rollback:

```bash
fly ssh sftp put --app "$APP" ./magnet-backup.db /app/.data/restored.db
fly ssh console --app "$APP" --command 'chown magnet:magnet /app/.data/restored.db'
fly secrets set --app "$APP" MAGNET_DB_FILE=/app/.data/restored.db
pnpm smoke "https://$APP.fly.dev"
```

Stop writes during the restore window and use a fresh destination filename each
time. Store backups off the machine and restrict access like production data.

Postgres: use the matching major-version client tools, a backup role that can
read all workspaces (RLS otherwise filters data), and a newly created restore
database. Use `PGSERVICE`/`.pg_service.conf` and a restricted `.pgpass` so passwords
do not appear in command arguments:

```bash
PGSERVICE=magnet_backup pg_dump --format=custom --no-owner --file=magnet-backup.dump
PGSERVICE=magnet_restore pg_restore --exit-on-error --single-transaction --no-owner --dbname=magnet_restored magnet-backup.dump
DATABASE_URL="$RESTORED_MIGRATION_DATABASE_URL" MAGNET_DATABASE_APP_ROLE=lnkz_app pnpm db:migrate
DATABASE_URL="$RESTORED_APP_DATABASE_URL" pnpm start
```

The destination must be empty. Verify readiness, search and a handoff before
switching traffic. Restore database roles/grants separately; `pg_dump` does not
back up global roles. Keep the original database until verification completes.

## Deployment assets brought over from LLMM

`render.yaml` now builds the root Dockerfile, mounts `/app/.data`, and checks
`/ready`. Supply the public URL and admitted hosts/origins in Render before
exposing the service. The current Fly runbook above remains the primary path.

The optional AWS template lives in `infra`. From the repository root:

```bash
pnpm infra:synth
pnpm --filter @magnet/infra diff
```

Synthesis validates the template locally; `diff` requires AWS credentials.
Construct IDs from LLMM are retained. The autoscaling name is shortened to fit
AWS's 32-character limit; review the infrastructure diff before updating a stack.
See [infra/README.md](infra/README.md)
before deploying. Consolidation does not deploy either provider configuration.

## Native mobile distributions

See [apps/mobile/README.md](apps/mobile/README.md#native-builds) for the checked-in
EAS profiles. Exporting `/mobile/` does not build or verify an Android or iOS binary.
The native app needs a reachable HTTPS relay and separately entered credentials.

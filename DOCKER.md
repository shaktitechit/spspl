# Running OPMS with Docker

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)

## Setup

1. Create env file:

   ```bash
   cp .env.docker.example .env.docker
   ```

2. Edit `.env.docker` and set at least:
   - `JWT_SECRET` — long random string
   - `MONGO_URI` / `MONGODB_URI` — your Mongo connection
   - Optional: SMTP, WhatsApp, Graph, VAPID, company branding

3. Link `.env` for Compose interpolation (or always pass `--env-file .env.docker`):

   ```bash
   ln -sfn .env.docker .env
   ```

   Service containers load secrets from `env_file: .env.docker`. Do not re-declare
   `MONGO_URI` / `JWT_SECRET` under `environment:` — an empty `${VAR}` would override them.

## Production-style stack

```bash
docker compose --env-file .env.docker up --build
```

## Development (hot reload)

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Source folders are mounted read-only; Node/Next watch for changes.

## URLs (defaults from `.env.docker`)

| Service              | URL                           |
|----------------------|-------------------------------|
| OPMS Frontend        | http://localhost:7002         |
| App Frontend         | http://localhost:7013         |
| User Manager         | http://localhost:7004         |
| Work Planner         | http://localhost:7008         |
| Lead Manager         | http://localhost:7010         |
| OPMS Backend         | http://localhost:7001         |
| Auth Service         | http://localhost:7003         |
| Health               | http://localhost:7001/health  |

Default seeded password (if `SEED_PASSWORD` is set): see `.env.docker`.

## Useful commands

```bash
# Detached
docker compose --env-file .env.docker up -d --build

# Logs
docker compose --env-file .env.docker logs -f opms-backend

# Stop (keeps volumes)
docker compose --env-file .env.docker down

# Stop and wipe Redis data
docker compose --env-file .env.docker down -v

# Seed users manually (optional)
docker compose --env-file .env.docker exec opms-backend npm run seed:users
```

## Environment notes

- **All secrets and credentials live in `.env.docker`** — compose files only reference `${VAR}`.
- **Redis** in Compose: `requirepass` via `REDIS_PASSWORD` (default `changeme` if unset); host bind `127.0.0.1:${REDIS_PORT:-7014}` → `6379`. Compose **always** injects `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379` so a stale unauthenticated `REDIS_URL` in `.env.docker` cannot cause `NOAUTH`.
- **message-service / notification-service** are internal-only (not published on the host); reach them on the Compose network or via nginx.
- **`NEXT_PUBLIC_*`** values are baked into frontend builds. Change them in `.env.docker`, then rebuild the affected frontend image.
- **Company branding**: set `COMPANY_NAME` / `NEXT_PUBLIC_COMPANY_*` as fallbacks, or configure via User Manager → Company Information (preferred).
- **CORS**: add production frontends to `CORS_ORIGINS` (comma-separated).
- **File uploads**: set `FILE_MANAGEMENT_API_URL` and `FILE_MANAGEMENT_API_KEY` if using the external file service.
- **Atlas / remote Mongo**: set `MONGO_URI` and `MONGODB_URI` in `.env.docker` (containers use `host.docker.internal` for host Mongo).

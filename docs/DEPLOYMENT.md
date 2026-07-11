# Zero-Downtime Deployment Runbook — LiveChat CCB

## Prerequisites

- Docker + Docker Compose v2 installed on the host.
- `.env` present with all required vars (`APP_ENV`, `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_OWNER_ID`, `API_URL`, `DATABASE_URL`).
- Production compose file: `docker-compose.yml` (uses `APP_ENV=production` by default).
- Dev/staging compose file: `docker-compose.dev.yml` (uses `APP_ENV=staging` by default).

---

## 1. Health-gated rolling replace (standard deploy)

```sh
# 1. Build new image
docker compose build

# 2. Start new container; --wait blocks until /health returns 200 (healthcheck passes)
docker compose up -d --wait --no-deps livechatccb
```

`--wait` relies on the `HEALTHCHECK` in the Dockerfile and the `healthcheck:` block in `docker-compose.yml`. The new container is not considered ready until both Prisma (`SELECT 1`) and the Discord client (`isReady()`) report healthy via `/health/ready`.

**Do not skip `--wait`.** Without it the old container shuts down before the new one is ready.

---

## 2. Pre-deploy checklist

- [ ] Verify `APP_ENV` in `.env` matches the target tier (`production` or `staging`).
- [ ] Verify `DATABASE_URL` coherence: production must **not** contain `sqlite-dev`; staging **must** contain `dev`. The server will abort boot if violated.
- [ ] Snapshot the SQLite volume before any migration:
  ```sh
  docker run --rm -v livechat_data:/data -v $(pwd):/backup alpine \
    tar czf /backup/sqlite-backup-$(date +%Y%m%d%H%M%S).tar.gz -C /data .
  ```
- [ ] Confirm no destructive migration: `prisma db push` is additive and idempotent; review schema changes before deploy.
- [ ] Confirm `/health/ready` passes on a staging deploy before promoting to production.

---

## 3. Rollback

```sh
# Re-tag the previous known-good image and restart
docker tag livechatccb:previous livechatccb:rollback
docker compose up -d --wait --no-deps livechatccb
```

Or, if using explicit image tags in compose, set `image: livechatccb:<prev-tag>` and run `docker compose up -d --wait`.

The healthcheck refuses promotion of a bad build automatically: if `/health` never returns 200 within `start_period + interval * retries`, the container is marked `unhealthy` and `restart: unless-stopped` will cycle it without serving traffic (when fronted by a reverse proxy keyed on health).

---

## 4. Reverse-proxy drain (recommended for zero HTTP/WS gap)

Front the container with HAProxy or Traefik and key backend availability on `/health/ready`. The proxy will only route traffic to the new instance once it reports ready, and will drain the old instance first. Socket.IO clients reconnect automatically within the drain window.

Example HAProxy backend check:
```
option httpchk GET /health/ready
http-check expect status 200
```

---

## 5. Log rotation

Both compose files configure Docker's `json-file` driver with `max-size: 10m` and `max-file: 5`, capping disk use per container at 50 MB. Logs are structured JSON in deployed environments — compatible with Loki/ELK/Datadog ingest (log shipping deferred to `feature/observability-logging` phase 2).

---

## 6. Observability — correlation ID

Every HTTP request carries a `correlation_id` (sourced from the inbound `x-request-id` header, or a generated UUID). This ID is bound to the child logger on each request and threads through Socket.IO connection logs and the `messagesWorker` queue path, enabling end-to-end tracing of a media send from Discord command to browser emit.

To trace a production incident:
```sh
docker compose logs livechatccb | grep '"correlation_id":"<id>"'
```

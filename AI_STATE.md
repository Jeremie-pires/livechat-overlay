# AI_STATE.md — LiveChat CCB

## Status
Branch `chore/haproxy-hardening` — HAProxy config hardened: X-Forwarded-Proto, http-keep-alive, /health probe.

---

## 1. Accomplished (current sprint — local-dev fixes + infra hardening)

**Previous sprint (`feature/network-optimization`):**
- SSRF guard, streaming OG parse, IP-pinned fetch, shared `parseDuration`, 300 tests green, SonarQube Quality Gate cleared.

**`bugfix/local-dev-dashboard` (US-1, US-2):**
- `src/services/env.ts`: APP_ENV enum → `production|staging|development` with `.default('development')`.
- `src/components/dashboard/dashboardRoutes.ts`: `secureFlag` env-gates the `; Secure` cookie attribute.
- `src/server.ts`: `trustProxy: true` added; `corsAllowedHeaders` extracted as shared constant.
- `.env.example`: Synced with full Zod schema.
- Tests: env type + development path cases added.

**`chore/haproxy-hardening` (US-3, US-4):**
- `.pipeline/haproxy.current.cfg`:
  - Added `http-request set-header X-Forwarded-Proto https` and `X-Forwarded-Port 443` to `frontend livechat_https` (H1).
  - Replaced `option http-server-close` with `option http-keep-alive` in both backends (H3).
  - Changed health probe from `GET /client` to `GET /health` in both backends (H4/S6).
  - Pair with `trustProxy: true` in Fastify (`bugfix/local-dev-dashboard`) to restore real client IP end-to-end (H2).

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/env.ts` | Zod env schema — `APP_ENV` now `production\|staging\|development` (default: `development`) |
| `src/services/url-guard.ts` | SSRF guard → `AssertedUrl { url, ip, family }`; empty-DNS guard |
| `src/services/content-utils.ts` | Streaming OG parse; IP-pinned fetch; guard threaded from resolveProviderMediaUrl |
| `src/services/utils.ts` | `parseDuration` (shared), `getDurationFromGuildId` |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo` |
| `src/services/broadcastClassifier.ts` | `classifyDiscordError`, `persistBroadcastRun` (fail-safe), `mintRunId` |
| `src/services/broadcast.ts` | `broadcastToAllGuilds()` → `BroadcastResult[]` |
| `src/components/messages/messagesWorker.ts` | `resolveMediaDurationMs` (exported); `executeMessagesWorker` |
| `src/components/messages/sendCommand.ts` | Uses shared `parseDuration` from utils |
| `src/components/messages/hidesendCommand.ts` | Uses shared `parseDuration` from utils |
| `src/components/api/adminDbRoutes.ts` | Owner-only DB admin; per-guild latest broadcast |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + CSRF OAuth; cookies env-gated (Secure only when deployed) |
| `src/server.ts` | Fastify init: `trustProxy: true`; shared `corsAllowedHeaders` const |
| `desktop-client/src/main.ts` | Electron main; `assertHttpUrl` at all fetch sites |
| `.pipeline/haproxy.current.cfg` | Hardened: X-Forwarded-Proto, http-keep-alive, /health probe |

---

## 3. Next steps

1. **PR** `bugfix/local-dev-dashboard` → `develop`.
2. **PR** `chore/haproxy-hardening` → `develop`.
3. **PR** `chore/dead-code-cleanup` → `develop`.
4. **`displayMediaFull` full implementation** (deferred).
5. **Dashboard hardening** (post-merge): CSP/HSTS, SEC-03…06.
6. **Observability phase 2** — external log shipping (Loki/ELK).

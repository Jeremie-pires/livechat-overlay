# AI_STATE.md — LiveChat CCB

## Status
Branch `bugfix/local-dev-dashboard` — US-1 + US-2 implemented; ENV gate + cookie fix committed.

---

## 1. Accomplished (current sprint — local-dev fixes + infra hardening)

**Previous sprint (`feature/network-optimization`):**
- SSRF guard (`url-guard.ts`), streaming OG parse, IP-pinned fetch, shared `parseDuration`, 300 tests green, SonarQube Quality Gate cleared.

**`bugfix/local-dev-dashboard` (US-1, US-2):**
- `src/services/env.ts`: `APP_ENV` enum extended to `['production', 'staging', 'development']` with `.default('development')` — `pnpm dev` now boots without requiring `APP_ENV` in `.env`.
- `src/components/dashboard/dashboardRoutes.ts`: `secureFlag` computed inside `dashboardPlugin` (`env.APP_ENV !== 'development' ? '; Secure' : ''`). All 4 `Set-Cookie` calls (`oauth_state` set/clear, `session` set/clear) now inject `${secureFlag}` instead of hardcoded `; Secure`. Dashboard login works over `http://localhost`.
- `src/server.ts`: `trustProxy: true` added to Fastify constructor (H2/S3 — real client IP restored in logs behind HAProxy). Shared `corsAllowedHeaders` array extracted; both `fastify-socket.io` and `@fastify/cors` registrations reference the same constant (S4 — no more sync drift).
- `.env.example`: Brought to parity with Zod schema — `APP_ENV`, `NODE_ENV`, `PORT`, `LOG`, `I18N`, `DEFAULT_DURATION`, `HIDE_COMMANDS_DISABLED` all documented (C3).
- `src/__tests__/services/env.test.ts`: `mockEnv.APP_ENV` type updated to include `'development'`; new test case verifies `validateEnvCoherence` does not throw for `development` + any DB URL.
- `src/__tests__/services/env.coherence.integration.test.ts`: `AppEnv` type updated to include `'development'`; new test case confirms `development` always returns `'ok'` from `checkCoherence`.

**`chore/haproxy-hardening` (US-3, US-4):**
- `.pipeline/haproxy.current.cfg`: Added `http-request set-header X-Forwarded-Proto https` and `X-Forwarded-Port 443` to `frontend livechat_https`. Both backends: `option http-server-close` replaced by `option http-keep-alive`; health probe changed from `GET /client` to `GET /health` (H1, H3, H4 cleared).

**`chore/dead-code-cleanup` (US-5):**
- `package.json`: Removed `@socket.io/postgres-emitter` (C1 — dead dependency, no Postgres anywhere).
- `haproxy.cfg.example`: Reconciled with hardened `haproxy.current.cfg` — same `X-Forwarded-Proto`, `http-keep-alive`, `GET /health` probe pattern (C2 cleared).

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

1. **PR** `bugfix/local-dev-dashboard` → `develop` (AC: cookie persists on localhost; pnpm dev boots with no APP_ENV).
2. **PR** `chore/haproxy-hardening` → `develop` (AC: logs show real client IP; HAProxy reports DOWN when DB is unreachable).
3. **PR** `chore/dead-code-cleanup` → `develop` (AC: pnpm install + 300 tests green, no unused deps).
4. **`displayMediaFull` full implementation** (deferred): worker reads Guild row at dispatch, injects flag into Socket.IO payload, client applies CSS.
5. **Dashboard hardening ticket** (post-merge): CSP/HSTS headers, `data-*` onclick pattern, admin-DB 401 tests (SEC-03…06).
6. **Observability phase 2** — external log shipping (Loki/ELK).

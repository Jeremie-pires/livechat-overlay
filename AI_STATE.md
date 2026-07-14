# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — all three audit branches merged; B2 + B4 NO-GO blockers cleared. CI lockfile up to date.

---

## 1. Accomplished (current sprint — local-dev fixes + infra hardening)

**Previous sprint (`feature/network-optimization`):**
- SSRF guard, streaming OG parse, IP-pinned fetch, shared `parseDuration`, 300 tests green, SonarQube Quality Gate cleared.

**`bugfix/local-dev-dashboard` (US-1, US-2) — merged:**
- `src/services/env.ts`: APP_ENV enum → `production|staging|development` with `.default('development')`.
- `src/components/dashboard/dashboardRoutes.ts`: `secureFlag` env-gates the `; Secure` cookie attribute — empty on `development`.
- `src/server.ts`: `trustProxy: true` added; `corsAllowedHeaders` extracted as shared constant (S4).
- `.env.example`: Synced with full Zod schema (C3).
- Tests: env type and development path cases added.

**`chore/haproxy-hardening` (US-3, US-4) — merged:**
- `haproxy.cfg.example`: `X-Forwarded-Proto https` + `X-Forwarded-Port 443` headers; `option http-server-close` → `option http-keep-alive`; health probe `GET /client` → `GET /health` (H1, H3, H4/S6).
- `.pipeline/haproxy.current.cfg` (local only — gitignored): same hardening applied on disk.

**`chore/dead-code-cleanup` (US-5) — merged:**
- `package.json`: Removed `@socket.io/postgres-emitter` — no Postgres anywhere in the codebase; pure supply-chain dead weight (C1).

**Post-merge fixes (B2 + B4 from review.md NO-GO):**
- `src/services/env.ts`: `DISCORD_OWNER_ID` + `DISCORD_CLIENT_SECRET` promoted from `.optional()` to `.string().min(1)` — eliminates OWASP A01 owner-gate bypass (CRIT-01/B2).
- `pnpm-lock.yaml`: Regenerated after dep removal; `@socket.io/postgres-emitter` fully absent; `pnpm install --frozen-lockfile` now passes in CI (B4). 301 tests green.

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

---

## 3. Next steps

1. **`displayMediaFull` full implementation** (deferred): worker reads Guild row at dispatch, injects flag into Socket.IO payload, client applies CSS.
2. **Dashboard hardening** (post-merge): CSP/HSTS headers, `data-*` onclick pattern, admin-DB 401 tests (SEC-03…06).
3. **Standing debt** (from review.md §3): HIGH-02 bad CORS allow-list entries; CQ-03 `isDeployedMode` dedup; MED-01 `validateEnvCoherence` fragile heuristics.
4. **Observability phase 2** — external log shipping (Loki/ELK).

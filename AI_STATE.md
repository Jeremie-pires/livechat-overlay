# AI_STATE.md — LiveChat CCB

## Status
Branch `fix/critical-remediation-phase1` — Phase 1 critical remediations (C-01…C-04) implemented. Lockfile regenerated.

---

## 1. Accomplished (current sprint — critical remediations)

**Previous sprints (merged into `develop`):**
- SSRF guard, streaming OG parse, IP-pinned fetch, shared `parseDuration`, 301 tests green.
- `APP_ENV` enum, `secureFlag` cookie gate, `trustProxy`, `corsAllowedHeaders`.
- HAProxy hardening (`X-Forwarded-Proto`, keep-alive, `/health` probe).
- Dead dep removal (`@socket.io/postgres-emitter`), DISCORD_OWNER_ID/CLIENT_SECRET made required, lockfile regenerated.

**`fix/critical-remediation-phase1` (C-01…C-04) — in progress:**

**C-01 — Atomic queue dequeue (`messagesWorker.ts`):**
- Replaced non-atomic `findFirst` + late `delete` with `prisma.$transaction`: `deleteMany({ id })` first (count=0 → tick lost race, returns null), then `guild.upsert`. Emit happens only after transaction commits with claimed row. Exactly-once semantics guaranteed under SQLite's serialized write model.

**C-02 — TTS temp file cleanup (`talkCommand.ts`, `hidetalkCommand.ts`, `gtts.ts`):**
- Wrapped generate→use in `try { ... } finally { deleteGtts(filePath).catch(...) }` so cleanup runs on both success and error paths. Removed inline `deleteGtts()` calls from happy/error paths (now handled exclusively by finally).
- `gtts.ts`: `deleteGtts` now typed `(filePath: string): Promise<void>` and silently swallows ENOENT (throws other errors for finally `.catch()` to log).

**C-03 — CVE dependency overrides (`package.json`, `pnpm-lock.yaml`):**
- Added `pnpm.overrides`: `"tar": ">=6.2.1"` (CVE-2024-28863), `"yaml": ">=2.3.4"`, `"qs": ">=6.11.0"` (CVE-2022-24999).
- Existing overrides (`form-data`, `undici`, `cross-spawn`, `find-my-way`, `ws`, `socket.io-parser`) retained.
- Lockfile regenerated via `pnpm install`.

**C-04 — CSRF on POST endpoints (`session.ts`, `dashboardRoutes.ts`):**
- `session.ts`: Added `csrfTokens` Map (sessionToken → csrfToken); `createCsrfToken(sessionToken)`, `validateCsrfToken(sessionToken, csrfToken)` (constant-time compare via `crypto.timingSafeEqual`). CSRF tokens purged on `deleteSession` and expired-session eviction in `isValidSession`.
- `dashboardRoutes.ts`: Import `createCsrfToken`, `validateCsrfToken`. HTML template gains `<meta name="csrf-token" content="{{CSRF_TOKEN}}">`. `/dashboard` GET generates CSRF token and injects it. Client JS reads meta tag, sends `X-CSRF-Token` header on `toggleMaintenance` POST. `/api/maintenance/toggle` validates CSRF token → 403 on mismatch.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/env.ts` | Zod env schema — `APP_ENV` now `production\|staging\|development` (default: `development`) |
| `src/services/session.ts` | Session + CSRF token maps; `createCsrfToken`, `validateCsrfToken` (timing-safe) |
| `src/services/gtts.ts` | TTS helpers; `deleteGtts` now ENOENT-resilient |
| `src/services/url-guard.ts` | SSRF guard → `AssertedUrl { url, ip, family }`; empty-DNS guard |
| `src/services/content-utils.ts` | Streaming OG parse; IP-pinned fetch |
| `src/services/utils.ts` | `parseDuration` (shared), `getDurationFromGuildId` |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo` |
| `src/services/broadcastClassifier.ts` | `classifyDiscordError`, `persistBroadcastRun` (fail-safe), `mintRunId` |
| `src/services/broadcast.ts` | `broadcastToAllGuilds()` → `BroadcastResult[]` |
| `src/components/messages/messagesWorker.ts` | Atomic claim-by-delete via `$transaction`; `resolveMediaDurationMs` |
| `src/components/messages/talkCommand.ts` | TTS file cleanup via try/finally |
| `src/components/messages/hidetalkCommand.ts` | TTS file cleanup via try/finally |
| `src/components/messages/sendCommand.ts` | Uses shared `parseDuration` from utils |
| `src/components/messages/hidesendCommand.ts` | Uses shared `parseDuration` from utils |
| `src/components/api/adminDbRoutes.ts` | Owner-only DB admin; per-guild latest broadcast |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + OAuth + CSRF (synchronizer token, X-CSRF-Token header) |
| `src/server.ts` | Fastify init: `trustProxy: true`; shared `corsAllowedHeaders` const |
| `desktop-client/src/main.ts` | Electron main; `assertHttpUrl` at all fetch sites |

---

## 3. Next steps

1. **Phase 2** (`fix/important-remediation-phase2`) — I-01…I-11: `deferReply`, security headers, XSS sanitisation, Prisma error boundaries, Docker hardening, tsx move to devDeps, session TTL eviction, Discord handler tests, guild REST fallback, APP_ENV leak from /health, DB probe timeout.
2. **Phase 3** (`chore/low-priority-phase3`) — L-01…L-07: tsconfig strict, console.error → logger, Dockerfile alpine-sdk dedup, TZ env var, socketLoader timer fix, isDeployedMode harden, non-null assertion guards.
3. **`displayMediaFull` full implementation** (deferred): worker reads Guild row at dispatch, injects flag into Socket.IO payload, client applies CSS.
4. **Observability phase 2** — external log shipping (Loki/ELK).

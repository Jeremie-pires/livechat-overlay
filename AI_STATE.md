# AI_STATE.md — LiveChat CCB

## Status
Sprint DevSecOps — Objective 1 complete + Vitest installed. Branch `feature/env-isolation-msg`: all blockers, OWASP patches, and unit tests applied. Ready to merge → `develop`.

---

## 1. Accomplished (current session)

**Blockers resolved (review.md B1 + B2):**
- `socketLoader.ts`: runtime `join-room` payload validation (type, length 0–200); reject if `roomId` not prefixed by `ROOM_PREFIX`; `guildId` validation (`/^\d+$/`); `socket.join()` now conditional. Covers VULN-01 + QUAL-01.
- `server.ts`: CORS restricted to `new URL(env.API_URL).origin` via shared `corsOrigin` function (Socket.IO + FastifyCORS). `origin: true` removed. Covers VULN-02.

**Security fixes (same PR):**
- `env.ts`: `DATABASE_URL` masked in boot log (`://[masked]@` if credentials present). Covers VULN-06.
- `session.ts`: `deleteSession(token)` export added.
- `dashboardRoutes.ts`: `deleteSession` imported; `/auth/logout` revokes token server-side before expiring cookie; `Secure` attribute added to login and logout cookies. Covers VULN-04 + VULN-05.
- `dashboardRoutes.ts`: `esc()` helper (5 HTML substitutions) injected in dashboard JS; applied on `displayName`, `avatarUrl`, `guild.name`, `guild.icon`, `e.type`, `e.message`, `title` tooltip. Covers VULN-03.

**Quality fixes:**
- `messagesWorker.ts`: `JSON.parse` moved before Socket.IO emit and DB delete; try/catch with explicit discard on invalid JSON. Covers QUAL-02.
- `stopCommand.ts`: `prisma.guild.update` → `upsert` (prevents P2025 on unconfigured guild). Covers QUAL-03.
- `client.html`: `JSON.parse(message.content)` wrapped in try/catch; calls `onContentDone(myToken)` on error to release queue. Covers QUAL-04.
- `env.ts`: `currentEnv()` simplified (`env.NODE_ENV.toLowerCase().trim()`). Covers QUAL-05.
- `server.ts`: `[DB] Connected` log moved after `await loadPrismaClient()`. Covers QUAL-06.

**Tests (Vitest — 43 tests, 5 files, all passing):**
- `vitest` installed as dev dependency; `"test": "vitest run"` added to `package.json`; `vitest.config.ts` created with `setupFiles`.
- `src/__tests__/setup.ts`: sets all required `process.env` vars for test isolation.
- `src/__tests__/services/env.test.ts`: 6 tests — `validateEnvCoherence` logic (pure function, mocks env module).
- `src/__tests__/services/session.test.ts`: 10 tests — `createSession`, `getSessionToken`, `isValidSession` (incl. TTL expiry with fake timers).
- `src/__tests__/services/env.coherence.integration.test.ts`: 6 tests — coherence heuristic edge cases.
- `src/__tests__/loaders/socketLoader.test.ts`: 9 tests — `isValidRoom` logic (prefix, guildId format, null/object rejection).
- `src/__tests__/components/messages/messagesWorker.test.ts`: 8 tests — `getMediaType` + empty-queue behavior (global mocks).
- `.github/workflows/release.yml`: `pnpm test` step already active (no change needed).

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/loaders/socketLoader.ts` | Namespaced rooms `${APP_ENV}:messages-*`; conditional join + validations |
| `src/server.ts` | Strict CORS (`API_URL.origin`); DB log post-connect |
| `src/services/env.ts` | `APP_ENV` Zod enum; `validateEnvCoherence()` fail-fast; DSN masked |
| `src/services/session.ts` | `createSession` / `getSessionToken` / `isValidSession` / `deleteSession` |
| `src/components/dashboard/dashboardRoutes.ts` | `esc()` XSS helper; `Secure` cookie; server-side logout |
| `src/components/messages/messagesWorker.ts` | Parse-before-delete; rooms `${APP_ENV}:messages-*` |
| `src/components/messages/stopCommand.ts` | `upsert` guild on stop |
| `src/components/client/client.html` | `server:env` handshake; `JSON.parse` try/catch |
| `src/__tests__/` | Vitest suites (5 files, 43 tests) — services, loaders, components |
| `vitest.config.ts` | Vitest config — node env + setupFiles |

---

## 3. Next steps

1. **Merge** `feature/env-isolation-msg` → `develop` + staging validation (Discord dev bot + Desktop App Dev)
2. **`feature/observability-logging`** — `correlation_id` per request, `/health` + `/health/ready` endpoints, Docker log rotation
3. **`feature/security-remediation`** — active client handshake validation (reject if `server:env` ≠ build profile), SRI for Tailwind CDN, wire Vitest tests to real source imports (currently use local pure functions)
4. **`feature/network-media-optim`** — media by URL, compression, cache
5. **`chore/deploy-zero-downtime`** — deploy scripts, HAProxy readiness gate, rollback

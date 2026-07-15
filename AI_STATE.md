# AI_STATE.md — LiveChat CCB

## Status
Branch `fix/important-remediation-phase2` — Phase 1 blockers + Phase 2 IMPORTANT remediations (I-01…I-11) fully committed. Phase 3 LOW PRIORITY items assessed: L-04/L-05/L-06 resolved; L-01/L-02/L-03/L-07 deferred or N/A. Test suite green (327/327). Lint clean.

---

## 1. Accomplished

### Previous sprints (merged into `develop`)
- SSRF guard, streaming OG parse, IP-pinned fetch, shared `parseDuration`, 301 tests green.
- `APP_ENV` enum, `secureFlag` cookie gate, `trustProxy`, `corsAllowedHeaders`.
- HAProxy hardening (`X-Forwarded-Proto`, keep-alive, `/health` probe).
- Dead dep removal, DISCORD_OWNER_ID/CLIENT_SECRET made required, lockfile regenerated.

### `fix/critical-remediation-phase1` (C-01…C-04 + BLOCK-1/BLOCK-2)

| ID | What | Files |
|---|---|---|
| C-01 | Atomic queue dequeue via `$transaction` | `messagesWorker.ts` |
| C-02 | TTS temp file cleanup via `try/finally` | `talkCommand.ts`, `hidetalkCommand.ts`, `gtts.ts` |
| C-03 | CVE dep overrides (`tar`, `yaml`, `qs`) + lockfile regen | `package.json` |
| C-04 | CSRF synchronizer token on POST `/api/maintenance/toggle` | `session.ts`, `dashboardRoutes.ts` |
| BLOCK-1 | CSRF validation on DELETE `/db/guilds/:id` (server + client) | `adminDbRoutes.ts`, `dashboardRoutes.ts` |
| BLOCK-2 | Dead comment removed `messagesWorker.ts`; explicit types on `gtts.ts` | both files |

### `fix/important-remediation-phase2` (I-01…I-11 + Phase 3 applicable)

| ID | What | Files |
|---|---|---|
| I-01 | `deferReply` on slow Discord handlers | `setupCommand.ts`, `setDefaultTimeCommand.ts`, `setMaxTimeCommand.ts` |
| I-02 | Baseline HTTP security headers via `onSend` hook | `server.ts` |
| I-03 | DOM XSS hardening: inline onclick removed; data-attributes + delegated events | `dashboardRoutes.ts` |
| I-04 | Error boundaries around `prisma.queue.create()` | `sendCommand.ts`, `hidesendCommand.ts`, `talkCommand.ts`, `hidetalkCommand.ts` |
| I-05 | Docker resource limits (`cpus: 1.0`, `memory: 512M`) | `docker-compose.yml` |
| I-06 | `tsx` moved to devDependencies; Dockerfile runner uses `--frozen-lockfile` | `package.json`, `Dockerfile` |
| I-07 | Session TTL eviction sweep (hourly, `.unref()`) | `session.ts` |
| I-08 | Unit tests for Discord command handlers + test bug fixes | `commandHandlers.test.ts`, `adminDbRoutes.test.ts` |
| I-09 | REST fallback (`guilds.fetch`) on guild cache miss in admin route | `adminDbRoutes.ts` |
| I-10 | Removed `APP_ENV` disclosure from `/health` | `healthRoutes.ts` |
| I-11 | DB probe wrapped with `Promise.race` 2 s timeout → 503 on hang | `healthRoutes.ts` |
| L-04 | `TZ` added to Zod env schema as optional | `env.ts` |
| L-05 | socketLoader stale-reference already fixed (`capturedSocketId`) | `socketLoader.ts` |
| L-06 | `isDeployedEnv` already uses enum-based whitelist | `env.ts` |

### Test fixes (part of this session)
- `commandHandlers.test.ts`: `makeRosetty` mock now returns `key.toLowerCase()` so Discord's `validateName` accepts the command names.
- `adminDbRoutes.test.ts`: auth-guard `beforeEach` now includes `global.logger` mock and `guilds.fetch` rejection stub, fixing 3 `lastBroadcast`-related failures.
- Upsert assertion corrected from `{ data: ... }` to `{ update: ... }` shape.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/env.ts` | Zod env schema — `APP_ENV` enum `production\|staging\|development`; `TZ` optional |
| `src/services/session.ts` | Session + CSRF maps; `createCsrfToken`, `validateCsrfToken` (timing-safe); `evictExpiredSessions` (hourly sweep) |
| `src/services/gtts.ts` | TTS helpers; fully typed; ENOENT-resilient `deleteGtts` |
| `src/services/url-guard.ts` | SSRF guard → `AssertedUrl { url, ip, family }` |
| `src/services/content-utils.ts` | Streaming OG parse; IP-pinned fetch |
| `src/services/utils.ts` | `parseDuration` (shared), `getDurationFromGuildId` |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo` |
| `src/services/broadcastClassifier.ts` | `classifyDiscordError`, `persistBroadcastRun`, `mintRunId` |
| `src/services/broadcast.ts` | `broadcastToAllGuilds()` → `BroadcastResult[]` |
| `src/components/messages/messagesWorker.ts` | Atomic claim-by-delete via `$transaction`; `resolveMediaDurationMs` |
| `src/components/messages/talkCommand.ts` | TTS cleanup try/finally; Prisma error boundary |
| `src/components/messages/hidetalkCommand.ts` | TTS cleanup try/finally; Prisma error boundary |
| `src/components/messages/sendCommand.ts` | Prisma error boundary on queue.create |
| `src/components/messages/hidesendCommand.ts` | Prisma error boundary on queue.create |
| `src/components/discord/setupCommand.ts` | deferReply before async guild fetch |
| `src/components/discord/setDefaultTimeCommand.ts` | deferReply before async guild fetch |
| `src/components/discord/setMaxTimeCommand.ts` | deferReply before async guild fetch |
| `src/components/api/adminDbRoutes.ts` | CSRF on DELETE; REST fallback on guild cache miss; lastBroadcast enrichment |
| `src/components/api/healthRoutes.ts` | No APP_ENV disclosure; DB probe 2 s timeout |
| `src/components/dashboard/dashboardRoutes.ts` | CSRF on DELETE client; no inline onclick; data-attributes + delegated events |
| `src/server.ts` | `onSend` hook: security headers (CSP, X-Frame, HSTS prod/staging) |
| `docker-compose.yml` | Resource limits: cpus 1.0, memory 512M |
| `package.json` | tsx in devDependencies |
| `Dockerfile` | Runner stage installs all deps via `--frozen-lockfile` |

---

## 3. Next steps

1. **Merge path**: `fix/important-remediation-phase2` → `develop` → `main`.
2. **`displayMediaFull` full implementation** (deferred): worker reads Guild row at dispatch, injects flag into Socket.IO payload, client applies CSS.
3. **Observability phase 2** — external log shipping (Loki/ELK).
4. **Remaining L-series** (low-priority, deferred):
   - L-01: tsconfig explicit strict flags (blocked by `ignoreDeprecations: "6.0"` preventing `tsc --noEmit` validation)
   - L-03: Dockerfile native-module double-build (requires architecture refactor)

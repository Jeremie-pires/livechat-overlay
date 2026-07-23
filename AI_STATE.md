# AI_STATE.md — LiveChat CCB

## Status
Branch `docs/security-audit-full` (off `develop`) — Full DevSecOps static-analysis audit committed to `.pipeline/full_security_audit.md`. 29 findings: 2 CRITICAL, 7 HIGH, 8 MEDIUM, 7 LOW, 5 OPTIMIZATION. No source files modified; audit is read-only.

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

## 3. Local OBS Server (desktop-client)

Added a local HTTP + Socket.IO server inside the Electron app so streamers can use `http://localhost:PORT/client?guildId=xxx` as an OBS Browser Source — no remote URL or token ever appears in OBS.

### New / modified files

| File | Change |
|---|---|
| `desktop-client/src/local-server.ts` | **NEW** — HTTP + Socket.IO server; bridges remote Fastify events; proxies `/client/*` assets |
| `desktop-client/src/utils.ts` | Added `localServerPort: number` (default 3001) to `AppSettings` + `normalizeSettings` |
| `desktop-client/src/main.ts` | Imports `startLocalServer / stopLocalServer / getLocalObsUrl`; starts on connect, stops on disconnect/quit; restarts on relevant settings change; `local-server:get-url` IPC handler; `local-server:url-changed` IPC push |
| `desktop-client/src/preload.ts` | Added `getObsUrl()` + `onObsUrlChanged()` to `window.livechat` bridge; `localServerPort` in type |
| `desktop-client/src/renderer/index.html` | OBS URL card in Control tab; port field in Config tab |
| `desktop-client/src/renderer/renderer.js` | `setObsUrl()`, copy button, `onObsUrlChanged` listener, `localServerPort` in form |
| `desktop-client/src/renderer/styles.css` | `.obs-url-section`, `.obs-url-row` styles |
| `desktop-client/package.json` | `socket.io ^4.7.4`, `socket.io-client ^4.7.4` added to dependencies |

### How it works
1. On overlay connect, `startLocalServer(settings)` starts a local HTTP server on port 3001 (auto-increment if busy)
2. Main process connects to remote Fastify as a Socket.IO **client** using existing credentials (token + guildId)
3. Receives `new-message` / `stop` from remote → re-emits to local Socket.IO clients
4. HTTP handler proxies `/client/*` routes from the remote server for assets (client.html, vidstack, images)
5. OBS Browser Source loads `http://localhost:3001/client?guildId=xxx` — `io()` auto-connects to local Socket.IO
6. Token never appears in OBS URL; remote server address stays hidden

---

## 4. Next steps

1. **Merge path**: `docs/security-audit-full` → `develop` → `main`.
2. **Audit remediation phase 3** — address findings from `.pipeline/full_security_audit.md`:
   - CRITICAL: C-AUD-01 (rate limiting via `@fastify/rate-limit`), C-AUD-02 (ffprobe DNS rebinding — pass IP-pinned URL or disable remote ffprobe)
   - HIGH: H-AUD-01 (Content-Security-Policy), H-AUD-02 (Docker runner dev-dep bloat), H-AUD-03 (process.env overwrite), H-AUD-04 (trustProxy IP restriction), H-AUD-05 (busyGuild TOCTOU in transaction), H-AUD-06 (scope Socket.IO emit payload), H-AUD-07 (log redaction dev mode)
3. **`displayMediaFull` full implementation** (deferred): worker reads Guild row at dispatch, injects flag into Socket.IO payload, client applies CSS.
4. **Observability phase 2** — external log shipping (Loki/ELK).
5. **Remaining L-series** (low-priority, deferred):
   - L-01: tsconfig explicit strict flags (blocked by `ignoreDeprecations: "6.0"` preventing `tsc --noEmit` validation)
   - L-03: Dockerfile native-module double-build (requires architecture refactor — tracked as O-AUD-01)

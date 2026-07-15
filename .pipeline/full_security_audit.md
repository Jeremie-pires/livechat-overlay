# Full DevSecOps Static-Analysis Audit — LiveChat CCB

**Date:** 2026-07-15  
**Auditor:** Claude Sonnet 4.6 (automated static analysis)  
**Commit SHA:** `8ec5c01ee35936b6c826f2b40ed9becf46ab31c0`  
**Branch audited:** `develop`  
**Scope:** Full codebase — HTTP/WebSocket server, Discord bot, queue worker, auth, dashboard, infra, Electron client

---

## Executive Summary

| Tier | Count |
|---|---|
| CRITICAL | 2 |
| HIGH | 7 |
| MEDIUM | 8 |
| LOW | 7 |
| OPTIMIZATION | 5 |
| **Total** | **29** |

**Top risks:**
1. No rate limiting on any HTTP or WebSocket endpoint — the entire surface is open to flooding, brute-force, and API-abuse amplification.
2. ffprobe is called with the original (non-IP-pinned) URL after the SSRF guard, creating a DNS-rebinding bypass window.
3. Content-Security-Policy is entirely absent from all HTTP responses, maximising the blast radius of any future XSS.
4. Docker runtime stage installs the full dependency tree including devDependencies and native build toolchain, significantly expanding the attack surface in production.
5. `process.env` is replaced in-place with the Zod env object, destroying system environment variables that child processes (ffprobe, gtts) require.

Prior remediation phases (C-01…C-04, I-01…I-11, L-04/L-05/L-06) are cross-referenced where relevant; findings already fully addressed are excluded.

---

## CRITICAL

### [C-AUD-01] No rate limiting on any HTTP endpoint or Socket.IO event

**Files:** `src/server.ts` (all routes), `src/loaders/socketLoader.ts` (all events), `src/components/dashboard/dashboardRoutes.ts` (`/auth/callback`, `/api/maintenance/toggle`, `/api/presence-events`)  
**Lines:** `src/server.ts:144-153` (CORS/register), `src/loaders/socketLoader.ts:42-110` (`join-room`, `sync-time`, `ping`), `src/components/dashboard/dashboardRoutes.ts:988-1126`  
**Severity:** CRITICAL

No rate-limiting plugin (e.g., `@fastify/rate-limit`) is registered anywhere. Every HTTP route and every Socket.IO event handler accepts requests at unlimited velocity from any source. Specific attack surfaces:

- **`/auth/callback`** — An attacker who obtains or brute-forces a Discord authorization code can hammer this endpoint, causing repeated outbound token-exchange requests to Discord's OAuth2 API, potentially triggering Discord-side rate-limiting or exhausting the server's connection pool.
- **`/api/stats` and `/api/admin/db/guilds`** — A stolen or replayed session cookie allows unlimited polling, generating unbounded Prisma query load.
- **Socket.IO `join-room`** — Unauthenticated clients can connect and call `join-room` at any frequency, issuing Prisma `clientSession.findUnique` queries and Discord `users.fetch` REST calls on every attempt.
- **Socket.IO `sync-time`** — Invocable at unlimited frequency; each call executes a callback to the caller.
- **`/api/presence-events` (SSE)** — While limited to authenticated sessions, a session leak allows an adversary to open a large number of persistent SSE connections, exhausting server file descriptors and Node.js event-loop capacity.

No prior remediation phase addresses application-layer rate limiting.

---

### [C-AUD-02] DNS-rebinding bypass: ffprobe called with original (pre-pinned) URL after SSRF guard

**File:** `src/services/content-utils.ts`  
**Lines:** `236-238` (`assertPublicHttpUrl` call), `250` (`effectiveUrl` construction), `285` (`getVideoDurationInSeconds(effectiveUrl, 'ffprobe')`)  
**Severity:** CRITICAL

`getContentInformationsFromUrl` calls `assertPublicHttpUrl(url)` at line 237, which performs DNS resolution and rejects private IPs. The IP-pinned URL is used for the HTTP fetch at line 268. However, `getVideoDurationInSeconds(effectiveUrl, 'ffprobe')` at line 285 passes the **original hostname** (not the resolved IP) directly to ffprobe as a process argument.

ffprobe performs its own independent DNS resolution when it opens the URL. Between the SSRF guard's DNS lookup and ffprobe's DNS lookup, a DNS TTL can expire and the attacker's DNS can now resolve to an internal IP (`127.0.0.1`, `10.x.x.x`, etc.). This is a classic Time-Of-Check / Time-Of-Use (TOCTOU) DNS-rebinding attack: the SSRF guard validates one IP, ffprobe connects to another.

Additionally, `effectiveUrl` can be a URL extracted from OG metadata (`providerResult?.url`, line 249), meaning the URL passed to ffprobe may be a second-hop URL whose guard status was checked at a prior point in time.

No prior remediation phase addresses the ffprobe DNS-rebinding vector (I-10 only removed APP_ENV from health; url-guard.ts correctly pins HTTP fetches but does not cover the ffprobe subprocess).

---

## HIGH

### [H-AUD-01] Missing Content-Security-Policy header on all responses

**File:** `src/server.ts`  
**Lines:** `90-98` (`onSend` security headers hook)  
**Severity:** HIGH

The `onSend` hook sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and (in deployed mode) `Strict-Transport-Security`. No `Content-Security-Policy` header is set anywhere. The dashboard at `/dashboard` serves a large inline `<script>` block and inline `<style>` blocks (dashboardRoutes.ts lines 19-963). Without a CSP:

- Any XSS payload injected into the dashboard (e.g., through a server-controlled data field) can execute arbitrary scripts, exfiltrate session tokens, and make credentialed requests.
- The dashboard's inline onclick handlers (lines 246, 250, 254, 258, 263, 267, 287-316, 333) prevent adoption of a `script-src 'nonce-...'` policy without further refactoring.

`X-Frame-Options: DENY` is present (partially mitigates clickjacking) but CSP `frame-ancestors` is not set as a defence-in-depth fallback.

---

### [H-AUD-02] Docker runner stage installs devDependencies and native build toolchain in production image

**File:** `Dockerfile`  
**Lines:** `18-40` (runner stage)  
**Severity:** HIGH

The runner stage (`FROM node:20-alpine AS runner`) duplicates the builder stage's `apk add` command at line 21:
```
apk add --no-cache ffmpeg python3 py3-pip py3-setuptools alpine-sdk
```
`alpine-sdk` (which includes gcc, make, musl-dev, binutils) and Python build infrastructure are installed in the runtime container. These are needed only for native module compilation in the builder stage.

Furthermore, `RUN pnpm install --frozen-lockfile` at line 32 installs the full dependency tree including all `devDependencies`: `vitest`, `eslint`, `prettier`, `husky`, `commitlint`, `pino-pretty`, `typescript`, `tsx`, `@typescript-eslint/*`. These tools increase the container's attack surface considerably: any RCE gained in the process can trivially escalate through the compiler toolchain or test runner.

This finding overlaps with deferred L-03 (native-module double-build) and partially with I-06 (tsx moved to devDeps) — I-06 moved tsx to devDeps but does not remove it from the runtime image because `pnpm install` without `--prod` flag still installs devDeps.

---

### [H-AUD-03] `process.env` replaced in-place — system environment destroyed for child processes

**File:** `src/index.ts`  
**Lines:** `26-27`  
**Severity:** HIGH

```ts
global.env = env;
//@ts-ignore
process.env = env;
```

`process.env` is fully replaced with the Zod-validated `env` object, which contains only the application's declared variables. All system environment variables (`PATH`, `HOME`, `USER`, `TMPDIR`, `LD_LIBRARY_PATH`, etc.) are destroyed. Child processes spawned after this point (ffprobe via `get-video-duration`, the Google TTS subprocess via the `gtts` npm package, and any `prisma` CLI invocations) inherit the truncated environment. This can cause:

- ffprobe failing to locate shared libraries (`LD_LIBRARY_PATH` missing).
- `gtts` failing to locate Python or the pip-installed gtts package (`PATH` missing).
- Unpredictable failures in any future `child_process.spawn`/`exec` call.

The `@ts-ignore` suppressor acknowledges that this assignment is type-unsafe.

---

### [H-AUD-04] `trustProxy: true` trusts all upstream IPs with no allowlist

**File:** `src/server.ts`  
**Lines:** `79`  
**Severity:** HIGH

`trustProxy: true` instructs Fastify (and the underlying `find-my-way` router) to unconditionally trust the `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Real-IP` headers from **any** connecting party. Any client that reaches the server directly (bypassing HAProxy, in misconfigured deployments, or through a misconfigured port binding) can forge these headers to spoof IP addresses. The oauth state comparison, logging correlation IDs, and any future IP-based rate limiting or allow-listing would all be bypassable.

Fastify supports `trustProxy: 1` (trust one hop) or a specific IP/CIDR to restrict trust to the known reverse proxy.

---

### [H-AUD-05] `messagesWorker` busyGuild check is outside the dequeue transaction — TOCTOU gap

**File:** `src/components/messages/messagesWorker.ts`  
**Lines:** `43-80`  
**Severity:** HIGH

The worker first checks whether the guild is busy at lines 43-60:
```ts
const busyGuild = await prisma.guild.findFirst({ where: { id: ..., busyUntil: { gte: new Date() } } });
if (busyGuild) { /* requeue */ }
```
Then, in a separate `$transaction` at lines 66-80, it deletes the queue row and upserts the guild's `busyUntil`. The gap between the `busyGuild` check and the transaction constitutes a TOCTOU window: another concurrent worker tick could claim the same guild and set `busyUntil` between the check and the transaction. In SQLite's single-writer model this window is narrow but non-zero under high-frequency polling (100ms interval). The consequence is a duplicate `new-message` emit for the same guild before `busyUntil` is set, potentially causing visual overlap on the display client.

The `deleteMany` in the transaction (C-01) prevents double-emit of the **same** queue row, but does not prevent emitting two *different* rows to the same guild simultaneously if both passed the `busyGuild` check before either transaction committed.

---

### [H-AUD-06] Full Queue row spread into Socket.IO `new-message` emit — unintended data exposure

**File:** `src/components/messages/messagesWorker.ts`  
**Lines:** `94-97`  
**Severity:** HIGH

```ts
fastify.io.to(`${env.APP_ENV}:messages-${lastMessage.discordGuildId}`).emit('new-message', {
  ...lastMessage,
  displayAt: dequeuedAt + MESSAGE_SYNC_LEAD_TIME_MS,
});
```

`lastMessage` is the raw Prisma `Queue` row, spread with `...lastMessage`. This emits every column to every connected Socket.IO client in the guild room, including:
- `author` (Discord username of the submitter)
- `authorImage` (Discord CDN avatar URL)
- `content` (raw JSON string, may include original message text)
- `busyRequeueMs` (internal timing telemetry)
- `discordReceivedAt`, `processingMs`, `submissionDate` (internal timestamps)
- `id` (internal UUID)

Socket.IO room membership requires knowing the guild ID (a public Discord snowflake) but no authentication token. Any actor who connects to the Socket.IO server and joins the room receives all internal Prisma row data. The minimum emit payload should be scoped to only the fields the browser client needs.

---

### [H-AUD-07] Pino redaction disabled in development — secrets may appear in logs

**File:** `src/server.ts`  
**Lines:** `48-65`  
**Severity:** HIGH

Log redaction of `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `req.headers.cookie`, and `req.headers.authorization` is configured only when `isDeployedMode()` is true (production or staging). In `development` mode, the logger is initialised with `{ level: logLevel }` — no redaction paths. Developer workstations running in development mode (e.g., with `pnpm dev` via tsx + pino-pretty) will log raw cookie headers and potentially secret values if they appear in error objects that propagate through Pino.

Additionally, `messagesWorker.ts:98`:
```ts
logger.debug(`[SOCKET] New message ${lastMessage.id} (guild: ...): ${lastMessage.content}`);
```
`lastMessage.content` is a JSON blob that may contain URL parameters with tokens (e.g., Discord CDN proxy URLs with access tokens). This is emitted at `debug` level even in deployed mode if `LOG=debug` is configured.

---

## MEDIUM

### [M-AUD-01] Logout route (GET) — CSRF-based forced session termination

**File:** `src/components/dashboard/dashboardRoutes.ts`  
**Lines:** `1121-1126`  
**Severity:** MEDIUM

`/auth/logout` is a `GET` route that deletes the session token and clears the cookie. GET requests do not require a CSRF token (correct for idempotent reads), but logout is a state-mutating operation. An adversary can embed `<img src="https://bot.example.com/auth/logout">` in any webpage the dashboard user visits, triggering a cross-site logout (logout CSRF). While less dangerous than privilege escalation, this can be used in social engineering (force logout mid-operation) or to frustrate session-based workflows.

---

### [M-AUD-02] TTS temp file name — timestamp + 1-100 random suffix risks collision under concurrency

**File:** `src/services/gtts.ts`  
**Lines:** `10-11`  
**Severity:** MEDIUM

```ts
const filePath = join(__dirname, `${Date.now()}-${Math.ceil(Math.random() * 100)}.mp3`);
```

The filename is composed of the millisecond timestamp and a random integer in `[1, 100]`. Under concurrent `/talk` commands (multiple guild members triggering TTS within the same millisecond), two invocations share the same `Date.now()` value and have a 1-in-100 collision probability on the random suffix. A collision causes one `gtts.save()` callback to overwrite the file written by another, resulting in the second invocation replying with the wrong audio. The `try/finally` cleanup in `talkCommand.ts` (I-02) deletes the file after use, but the window between creation and deletion is when a collision occurs.

---

### [M-AUD-03] `prisma.stats.upsert` and `prisma.latencySample.create` not wrapped in a transaction

**File:** `src/components/messages/messagesWorker.ts`  
**Lines:** `122-170`  
**Severity:** MEDIUM

```ts
await Promise.all([
  prisma.stats.upsert({ ... }),
  prisma.latencySample.create({ ... }),
]);
```

These two writes run concurrently but are not atomic. If `stats.upsert` succeeds and `latencySample.create` fails (or vice versa), the aggregate `Stats` row and the individual sample records diverge. Over time, rolling averages computed from `latencyCount` and samples in `latencySample` will be inconsistent. Wrapping both in a `$transaction` ensures either both succeed or both are rolled back.

---

### [M-AUD-04] `DISCORD_CLIENT_SECRET` presence check in `/auth/callback` is unreachable dead code

**File:** `src/components/dashboard/dashboardRoutes.ts`  
**Lines:** `989-991`  
**Severity:** MEDIUM

```ts
if (!env.DISCORD_CLIENT_SECRET) {
  return reply.status(503).send('DISCORD_CLIENT_SECRET not configured');
}
```

`DISCORD_CLIENT_SECRET` is declared as `z.string().min(1)` in `src/services/env.ts:23`. The Zod validation runs at startup (`createEnv`) and throws if the value is absent or empty — the process never reaches this route handler. The dead check creates a false impression that the secret can be absent at runtime and may mislead future maintainers into thinking the route handles a degraded state gracefully.

---

### [M-AUD-05] No audit logging for authentication or CSRF validation failures

**Files:** `src/components/dashboard/dashboardRoutes.ts`, `src/components/api/adminDbRoutes.ts`  
**Lines:** `dashboardRoutes.ts:1050-1052`, `adminDbRoutes.ts:62-64`  
**Severity:** MEDIUM

When CSRF token validation fails on `POST /api/maintenance/toggle` or `DELETE /db/guilds/:id`, the server returns HTTP 403 but writes no audit record. Similarly, failed authentication (invalid/expired session) on any protected route is silently rejected. The only existing audit record is `botEvent.create` on successful guild deletion (`adminDbRoutes.ts:73`). An attacker probing CSRF token enumeration or replaying stale sessions leaves no trace. Writing a `BotEvent` (or equivalent) for authentication failures and CSRF rejections would enable detection of brute-force and replay attacks.

---

### [M-AUD-06] Unbounded `LatencySample` and `BotEvent` table growth — no pruning

**Files:** `src/components/messages/messagesWorker.ts`, `src/loaders/DiscordLoader.ts`, `prisma/schema.prisma`  
**Lines:** `messagesWorker.ts:158-170`, `DiscordLoader.ts:89-93`, `schema.prisma:74-107`  
**Severity:** MEDIUM

`prisma.latencySample.create` is called on every message dispatch; `prisma.botEvent.create` is called on every bot start/stop/crash and guild deletion. Neither table has a TTL, maximum row count, or background pruning job. The stats query fetches the last 50 `LatencySample` rows and the last 100 `BotEvent` rows, but older rows are never deleted. On a busy bot processing thousands of messages per day, the `LatencySample` table will grow by thousands of rows/day indefinitely, increasing SQLite database file size and query latency over time.

---

### [M-AUD-07] Socket.IO `sync-time` event echoes arbitrary client data without type-checking

**File:** `src/loaders/socketLoader.ts`  
**Lines:** `116-124`  
**Severity:** MEDIUM

```ts
socket.on('sync-time', (clientSentAt, callback) => {
  if (typeof callback !== 'function') return;
  callback({ clientSentAt, serverNow: Date.now() });
});
```

`clientSentAt` is accepted from the client without any type or size validation. A malicious client can pass a deeply nested object, a very large string, or a non-serializable value. When the server calls `callback({ clientSentAt, ... })`, Socket.IO serialises the response back to the client. A sufficiently large or complex object could cause excessive serialisation overhead or, if the client-side handler uses the value unsafely, a reflected injection. Minimum validation: `typeof clientSentAt === 'number'` check before echoing.

---

### [M-AUD-08] OAuth callback `/auth/callback` not rate-limited — Discord API abuse vector

**File:** `src/components/dashboard/dashboardRoutes.ts`  
**Lines:** `988-1046`  
**Severity:** MEDIUM

The `/auth/callback` handler makes two outbound HTTP requests to Discord's API on every invocation: one to exchange the authorisation code for a token (`${DISCORD_API}/oauth2/token`, line 1009) and one to fetch the user profile (`${DISCORD_API}/users/@me`, line 1028). Without rate limiting, an adversary who can make repeated requests to `/auth/callback` (with or without a valid code) can cause the application to issue repeated outbound requests to Discord, potentially exhausting Discord's per-application rate limit for token exchange. This could deny legitimate dashboard login for the owner.

---

## LOW

### [L-AUD-01] Session cookie `SameSite=Lax` — not `Strict`

**File:** `src/components/dashboard/dashboardRoutes.ts`  
**Lines:** `1044`  
**Severity:** LOW

The session cookie is set with `SameSite=Lax`, which allows the cookie to be included in top-level cross-site GET navigations (e.g., clicking a link from another page). Because the only state-mutating routes are protected by CSRF tokens (POST maintenance toggle, DELETE guild), and the logout is a GET (noted in M-AUD-01), `SameSite=Strict` would provide an additional layer of CSRF protection without breaking functionality. `SameSite=Lax` is an acceptable baseline but `Strict` is preferable for an admin-only interface.

---

### [L-AUD-02] Electron auto-updater artifacts are unsigned — no code signing configuration

**File:** `desktop-client/package.json`  
**Lines:** `22-68` (electron-builder `build` config)  
**Severity:** LOW

The `electron-builder` configuration does not specify a `win.certificateFile`, `win.certificatePassword`, or any code signing provider. Artifacts built with `npm run release` are unsigned Windows executables. `electron-updater` validates that downloaded updates match the expected file hash (from `latest.yml` on GitHub Releases) but does not validate a code signature on the binary itself. A supply-chain compromise of the GitHub release (e.g., compromised GitHub token, tampered release asset before hash generation) could deliver unsigned malware to users. Code signing with a trusted certificate (e.g., Azure Trusted Signing) would allow Windows SmartScreen and AV engines to validate the publisher identity.

---

### [L-AUD-03] `docker:start` script uses `prisma db push` in production

**File:** `package.json`  
**Lines:** `8` (`docker:start` script), `Dockerfile:40` (`CMD`)  
**Severity:** LOW

```json
"docker:start": "pnpm migration:up && tsx ./src/index.ts"
```
`pnpm migration:up` calls `prisma db push` (mapped at line 11: `"migration:up": "prisma db push"`). `prisma db push` is designed for prototyping — it applies schema changes directly without generating migration files, and may silently drop columns or tables to match the schema. In production, `prisma migrate deploy` should be used instead, which applies idempotent migration files with checksums and supports rollback tracking.

---

### [L-AUD-04] `validateEnvCoherence` staging check uses fragile string-match heuristic

**File:** `src/services/env.ts`  
**Lines:** `52-57`  
**Severity:** LOW

```ts
if (appEnv === 'staging' && !dbUrl.includes('dev')) {
  throw new Error('[ENV] FATAL: APP_ENV=staging but DATABASE_URL does not reference a dev database...');
}
```

This check prevents booting on staging unless the `DATABASE_URL` string contains the substring `"dev"`. A legitimately named staging database path (e.g., `file:/data/staging.db`, or a remote staging DSN without `dev` in it) would trigger a fatal boot failure. The check is intended as a guard against using a production DB in staging, but the heuristic is too broad and may block valid staging configurations. A more explicit `APP_ENV` → `DATABASE_URL` pattern allowlist (or a separate `DATABASE_ENV` env var) would be more robust.

---

### [L-AUD-05] Missing indexes on `Queue.executionDate`, `Queue.discordGuildId`, `Guild.busyUntil`

**File:** `prisma/schema.prisma`  
**Lines:** `10-28` (Queue model), `30-37` (Guild model)  
**Severity:** LOW

The worker's hot path runs two queries on every 100ms tick:
1. `prisma.queue.findFirst({ where: { executionDate: { lte: new Date() } }, orderBy: { executionDate: 'asc' } })` — no index on `executionDate`.
2. `prisma.guild.findFirst({ where: { id: ..., busyUntil: { gte: new Date() } } })` — no index on `Guild.busyUntil`.

`Queue` has only `@@index([type])`. As the queue grows under load (many guilds, many messages), both queries perform full-table scans. Adding `@@index([executionDate])` on Queue and `@@index([busyUntil])` on Guild would significantly reduce scan cost. `Queue.discordGuildId` is also unindexed despite being used in `deleteMany` and `findFirst` filters.

---

### [L-AUD-06] Missing `Permissions-Policy` HTTP response header

**File:** `src/server.ts`  
**Lines:** `90-98` (`onSend` hook)  
**Severity:** LOW

The `onSend` hook does not set a `Permissions-Policy` header (formerly `Feature-Policy`). Modern browsers use this header to restrict access to sensitive browser APIs (camera, microphone, geolocation, payment, USB, etc.) from the dashboard page and any embedded content. While the current dashboard does not use these APIs, a missing policy defaults to permissive browser behaviour. A restrictive policy (e.g., `Permissions-Policy: camera=(), microphone=(), geolocation=()`) reduces the potential impact of any client-side code injection.

---

### [L-AUD-07] No `Cache-Control: no-store` on authentication and session routes

**File:** `src/components/dashboard/dashboardRoutes.ts`  
**Lines:** `975-986` (`/dashboard`), `988-1046` (`/auth/callback`), `1121-1126` (`/auth/logout`)  
**Severity:** LOW

Auth-sensitive routes (`/dashboard`, `/auth/callback`, `/auth/logout`) do not set `Cache-Control: no-store, no-cache` headers. Shared or proxy caches could store redirect responses or error bodies that contain OAuth `state` values, session identifiers embedded in error messages, or partial redirect pages with OAuth URLs. While `SameSite` and `HttpOnly` cookies limit direct exploitation, caching OAuth flow responses can leak state parameters to shared cache operators.

---

## OPTIMIZATION

### [O-AUD-01] Docker native-module double compilation — builder output not reused

**File:** `Dockerfile`  
**Lines:** `1-40`  
**Severity:** OPTIMIZATION

The builder stage (lines 1-16) installs native build tools and runs `pnpm install --frozen-lockfile`, compiling native modules (`bufferutil`, `utf-8-validate`, `zlib-sync`, `node-gyp`). The runner stage (lines 18-40) also runs `pnpm install --frozen-lockfile`, duplicating the entire native compilation step from scratch. The compiled `.node` binaries from the builder stage are not copied via `COPY --from=builder`. This doubles build time and is the root cause of the build toolchain presence in the runtime image (H-AUD-02). This was flagged as deferred L-03 in the prior remediation.

---

### [O-AUD-02] `latencySamples` fetched DESC then reversed in memory on every `/api/stats` call

**File:** `src/components/api/statsRoutes.ts`  
**Lines:** `17`, `46`  
**Severity:** OPTIMIZATION

```ts
prisma.latencySample.findMany({ orderBy: { id: 'desc' }, take: 50 })
// ...
const orderedSamples = latencySamples.reverse();
```

The 50 most-recent samples are fetched in descending order and then reversed in application memory. Fetching directly in ascending order (`orderBy: { id: 'asc' }`, filtered by a subquery for the last 50 IDs, or using `orderBy: { id: 'desc' }, take: 50` then a simple `reverse()` at the consumer) eliminates the in-memory reversal. The current approach is functionally correct but wasteful.

---

### [O-AUD-03] N+1 Discord REST calls in `GET /api/admin/db/guilds` for guild metadata

**File:** `src/components/api/adminDbRoutes.ts`  
**Lines:** `29-54`  
**Severity:** OPTIMIZATION

For each guild not found in `discordClient.guilds.cache`, an individual `discordClient.guilds.fetch(guild.id)` REST call is made (line 34). With N guilds not in the in-memory cache, this triggers N sequential or concurrent REST calls to Discord's API, each subject to Discord rate limits (50 requests/second global). Under the per-shard guild cache miss scenario (bot restart, large guild count), this endpoint blocks for O(N) API round trips. Batching or pre-populating the cache on startup would mitigate this.

---

### [O-AUD-04] Unbounded `broadcastLog.findMany` in admin guild route — no result-set limit

**File:** `src/components/api/adminDbRoutes.ts`  
**Lines:** `13-19`  
**Severity:** OPTIMIZATION

```ts
const broadcastLogs = guilds.length > 0
  ? await prisma.broadcastLog.findMany({
      where: { guildId: { in: guilds.map((g) => g.id) } },
      orderBy: { createdAt: 'desc' },
      select: { guildId: true, status: true, errorReason: true, createdAt: true },
    })
  : [];
```

No `take` limit is applied. As the `BroadcastLog` table grows (compounded by the unbounded growth noted in M-AUD-06), this query returns an ever-increasing result set loaded entirely into application memory just to find the most-recent log per guild. A per-guild `GROUP BY` subquery or a `take: guilds.length` with a proper ordering would bound the result set to at most one log per guild.

---

### [O-AUD-05] `cpuSampler` `setInterval` not `.unref()`'d — delays graceful shutdown

**File:** `src/services/cpuSampler.ts`  
**Lines:** `21-27`  
**Severity:** OPTIMIZATION

```ts
setInterval(() => { /* CPU sampling */ }, 2000);
```

This interval holds a Node.js event-loop reference, preventing the process from exiting naturally if all other async work completes. The session eviction sweep in `src/services/session.ts:18` correctly calls `.unref()`, but `cpuSampler`'s interval does not. During graceful shutdown (SIGTERM → `handleShutdown` in `DiscordLoader.ts`), the process calls `process.exit(0)` explicitly, so this does not cause a hang in the current implementation. However, if `process.exit` is ever replaced with a signal-driven natural exit, the unref'd sampler would delay shutdown by up to 2 seconds. Similarly, the SSE keepAlive `setInterval` in `dashboardRoutes.ts:1094` is cleaned up on `req.raw.close` but is not `.unref()`'d, holding a reference for the lifetime of each SSE connection.

---

## Appendix

### A. Scope Coverage Matrix

| Scope | Coverage |
|---|---|
| A — Security / OWASP Top 10 | A01 (access control, IDOR), A02 (cookie entropy, SameSite), A03 (XSS/CSP, injection), A04 (trust boundary), A05 (CORS, CSP absence, trustProxy), A06 (deps, electron signing), A07 (OAuth state, CSRF lifecycle, rate limiting), A08 (electron-updater signing), A09 (audit logging, log redaction), A10 (SSRF DNS rebinding) |
| B — Bugs & Logic Flaws | Race conditions (busyGuild TOCTOU), missing error boundaries (stats upsert atomicity), memory/timer management (cpuSampler, SSE keepAlive), dead code (client-secret check) |
| C — Dead Code & Tech Debt | Unreachable DISCORD_CLIENT_SECRET guard, process.env overwrite, staging heuristic fragility |
| D — Performance & Optimization | Docker image bloat, N+1 broadcastLog, unbounded table growth, latencySample sort direction, missing DB indexes |

### B. Files Inspected

| File | Read |
|---|---|
| `src/index.ts` | ✓ |
| `src/server.ts` | ✓ |
| `src/services/env.ts` | ✓ |
| `src/services/session.ts` | ✓ |
| `src/services/url-guard.ts` | ✓ |
| `src/services/content-utils.ts` | ✓ |
| `src/services/gtts.ts` | ✓ |
| `src/services/cpuSampler.ts` | ✓ |
| `src/loaders/DiscordLoader.ts` | ✓ |
| `src/loaders/RESTLoader.ts` | ✓ |
| `src/loaders/socketLoader.ts` | ✓ |
| `src/components/dashboard/dashboardRoutes.ts` | ✓ |
| `src/components/api/adminDbRoutes.ts` | ✓ |
| `src/components/api/statsRoutes.ts` | ✓ |
| `src/components/api/healthRoutes.ts` | ✓ |
| `src/components/messages/messagesWorker.ts` | ✓ |
| `src/components/messages/sendCommand.ts` | ✓ |
| `src/components/messages/talkCommand.ts` | ✓ |
| `prisma/schema.prisma` | ✓ |
| `Dockerfile` | ✓ |
| `docker-compose.yml` | ✓ |
| `package.json` | ✓ |
| `desktop-client/package.json` | ✓ |

### C. Known-Addressed Cross-References (excluded from findings unless residual gap)

| Prior ID | What was addressed | Audit verdict |
|---|---|---|
| C-01 | Atomic dequeue via `$transaction` | Fully addressed — residual TOCTOU on busyGuild check (H-AUD-05) is a new finding |
| C-02 | TTS temp file cleanup via `try/finally` | Fully addressed |
| C-03 | CVE dep overrides (tar, yaml, qs, ws, undici) | Fully addressed — pnpm.overrides applied |
| C-04 | CSRF on POST `/api/maintenance/toggle` | Fully addressed |
| BLOCK-1 | CSRF on DELETE `/db/guilds/:id` | Fully addressed |
| I-01 | `deferReply` on slow Discord handlers | Fully addressed |
| I-02 | Security headers via `onSend` | Partially addressed — CSP is still missing (H-AUD-01) |
| I-03 | DOM XSS hardening — data-attributes + delegated events | Partially addressed — delete/copy buttons use delegation; nav onclick handlers remain inline (prevents strict CSP) |
| I-04 | Prisma error boundaries on queue.create | Fully addressed |
| I-05 | Docker resource limits | Fully addressed |
| I-06 | tsx moved to devDeps, frozen-lockfile in runner | Partially addressed — runner still installs all devDeps (H-AUD-02) |
| I-07 | Session TTL eviction sweep + .unref() | Fully addressed |
| I-08 | Unit tests for command handlers | Out of audit scope |
| I-09 | REST fallback on guild cache miss | Fully addressed — N+1 pattern noted as O-AUD-03 |
| I-10 | APP_ENV removed from /health | Fully addressed |
| I-11 | DB probe 2s timeout in /health/ready | Fully addressed |
| L-04 | TZ in Zod env schema | Fully addressed |
| L-05 | socketLoader stale-reference fix | Fully addressed |
| L-06 | isDeployedEnv enum whitelist | Fully addressed |
| L-03 | Dockerfile native-module double-build | Deferred — still present (O-AUD-01, H-AUD-02) |

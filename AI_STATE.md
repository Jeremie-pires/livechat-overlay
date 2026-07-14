# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/network-optimization` — 300 tests green, lint clean, SonarQube Quality Gate fixed.

---

## 1. Accomplished (current sprint — local-dev fixes + infra hardening)

**Network optimization — `feature/network-optimization`:**
- `src/services/url-guard.ts`: `assertPublicHttpUrl` returns `AssertedUrl { url, ip, family }` — TOCTOU-safe fetch pinning. Added empty-DNS-array guard (SEC-02): `if (addresses.length === 0) throw new SsrfBlockedError(...)`.
- `src/services/content-utils.ts`: `resolveProviderMediaUrl` now returns `{ url, contentType, guard: AssertedUrl }` — guard is threaded through instead of discarded. `getContentInformationsFromUrl` uses `providerResult?.guard ?? urlGuard` directly, eliminating the second DNS lookup (SEC-01/CQ-03 closed). Streaming `readHtmlStreamUntilOg` (256 KB ceiling, early cancel), IP-pinned fetch at all sites.
- `src/services/utils.ts`: Shared `parseDuration(trimmed, mediaDuration)` helper exported here — replaces duplicated inline logic in both send commands (CQ-02).
- `src/components/messages/sendCommand.ts`: Imports `parseDuration` from utils, removes inline duration logic and `MAX_DURATION_SECONDS`. Uses `Number.isNaN` via shared helper (CQ-01).
- `src/components/messages/hidesendCommand.ts`: Imports `parseDuration` from utils, local copy removed.
- `src/components/messages/talkCommand.ts` + `hidetalkCommand.ts`: null guard for missing audio attachment.
- `src/components/messages/messagesWorker.ts`: `resolveMediaDurationMs` exported — `mediaDuration` clamped `[0, 3600]`, 5000 ms fallback. Called internally by `executeMessagesWorker`.
- Tests (300 green): telemetry (6), url-guard return shape + edge cases (8), content-utils streaming/pin (5), worker duration clamp (COV-01, refactored with it.each), shared parseDuration (CQ-02/COV-03, refactored with it.each), url-guard empty-DNS (SEC-02 coverage).
- SonarQube Quality Gate fixes (round 1): cognitive complexity reduced; void operator removed; durationClamp + parseDuration tests refactored with it.each.
- SonarQube Quality Gate fixes (round 2): url-guard isPrivateIp + reject suites collapsed to it.each; telemetry beforeEach eliminates repeated mock setup; adminDbRoutes DELETE beforeEach absorbs shared prisma setup + snowflakes collapsed to it.each; content-utils makeBodyResponse helper eliminates 5× inline stream response objects.

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

1. **PR** `feature/network-optimization` → `develop` (reviewer gave GO after §5 housekeeping — now cleared).
2. **`displayMediaFull` full implementation** (deferred): worker reads Guild row at dispatch, injects flag into Socket.IO payload, client applies CSS.
3. **Dashboard hardening ticket** (post-merge): CSP/HSTS headers, `data-*` onclick pattern, admin-DB 401 tests (SEC-03…06).
4. **Observability phase 2** — external log shipping (Loki/ELK).

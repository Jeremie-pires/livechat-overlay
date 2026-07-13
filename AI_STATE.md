# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/crud-database-dashboard` — IN PROGRESS (awaiting REVIEWER).

Previous: `hotfix/youtube-regression-1.2.7` — RELEASED as `1.2.8` (stable).
Previous: `feature/gif-link-support` — IN PROGRESS (awaiting REVIEWER).
Previous: `feature/security-remediation` — COMPLETE (REVIEWER GO ✅).
Previous: `bugfix/presence-and-security-hardening` — COMPLETE.
Previous: `bugfix/restrict-auto-update` — COMPLETE.
Previous: `bugfix/socket-room-sync` — COMPLETE.

---

## 1. Accomplished (all sprints)

**DB Viewer + Broadcast Logging — `feature/crud-database-dashboard`:**

- **`prisma/schema.prisma`** (UPDATED): Added `BroadcastLog` model (`runId`, `guildId`, `channelId`, `status`, `errorCode`, `errorReason`, `createdAt`; indexes on `runId`, `guildId`, `status`).
- **`prisma/migrations/20260713000000_add_broadcast_log/migration.sql`** (NEW): Additive migration — `CREATE TABLE BroadcastLog` + 3 indexes. Non-breaking.
- **`src/services/broadcastClassifier.ts`** (NEW): Pure, unit-tested service. Exports `BroadcastResult` type, `BroadcastStatus` union, `classifyDiscordError()` (maps Discord API error codes to stable reason strings; truncates long messages to 100 chars), `mintRunId()` (UUID), `persistBroadcastRun()` (single `createMany` per broadcast run).
- **`src/services/broadcast.ts`** (REFACTORED): `broadcastToAllGuilds()` now returns `BroadcastResult[]` instead of `void`. No outer `catch {}` swallowing — per-guild errors are classified and returned. Uses `classifyDiscordError` and `persistBroadcastRun` internally. Existing callers that ignore the return value continue to work.
- **`src/components/discord/announceCommand.ts`** (UPDATED): Delegates to `broadcastToAllGuilds()`; processes `BroadcastResult[]` to report `✅ N · ⚠️ M échecs` in the ephemeral reply; color is amber if failures occurred. Dead `catch {}` removed.
- **`src/components/discord/announceGuildCommand.ts`** (UPDATED): Uses `classifyDiscordError` + `persistBroadcastRun` for single-guild announce; logs result (SUCCESS or FAILED with reason) to `BroadcastLog`. Dead `catch {}` replaced with structured error handling.
- **`src/services/i18n/en.ts` / `fr.ts`** (UPDATED): Added `announceCommandFailures` key (`'⚠️ {{count}} failure(s) recorded.'` / `'⚠️ {{count}} échec(s) enregistré(s).'`).
- **`src/components/api/adminDbRoutes.ts`** (NEW): Fastify plugin mounted at `/api/admin`. Three session-guarded endpoints: `GET /db/guilds` (Guild rows + Discord cache join + last BroadcastLog per guild), `DELETE /db/guilds/:id` (snowflake validation, BotEvent audit `DB_PURGE`), `GET /db/broadcasts/latest` (latest run summary + rows).
- **`src/loaders/RESTLoader.ts`** (UPDATED): Mounts `AdminDbRoutes` at `/api/admin`.
- **`src/components/dashboard/dashboardRoutes.ts`** (UPDATED): Added "Base de données" sidebar nav item (database icon), `#page-database` page block (summary strip + guild table with failure-highlighted rows), `.db-table` + `.toast` CSS, and JS functions `loadDatabase()` / `renderGuildTable()` / `deleteGuild()` / `copyText()` / `showToast()`. Lazy-loads on first navigate; refreshes on 30 s tick when active.
- **`src/__tests__/services/broadcastClassifier.test.ts`** (NEW): 14 tests — all error code mappings, fallback, message truncation, null/undefined/non-object inputs, and BroadcastResult aggregation counts. Suite: 224 tests (was ≥210).

**YouTube Regression Hotfix + GIF + Telemetry — `hotfix/youtube-regression-1.2.7` → `1.2.8-rc.1`:**

- **`src/services/content-utils.ts`** (UPDATED): `isYouTubeUrl` early-return with `YOUTUBE_CONTENT_TYPE` sentinel. `resolveProviderMediaUrl` for Tenor/Giphy OG extraction. **Now returns `resolvedUrl`** — the CDN media URL extracted from OG tags — so clients receive the playable CDN URL instead of the provider page URL.
- **`src/services/telemetry.ts`** (NEW): Extracted `measureContentProcessing` + `ContentInfo` type from commands into a dedicated service. All four message commands import from here.
- **`src/components/messages/sendCommand.ts`** (UPDATED): Uses `additionalContent?.resolvedUrl ?? url` in queue content. Fixed `finalDuration = 0` regression for YouTube (now stays `undefined` → falls back to guild default).
- **`src/components/messages/hidesendCommand.ts`** (UPDATED): Same fixes as sendCommand. Cognitive complexity reduced from 28 → 14. Fixed `deferReply({ flags: … })` TS2769 → `deferReply({ ephemeral: true })`.
- **`src/components/messages/talkCommand.ts` / `hidetalkCommand.ts`** (UPDATED): Import `measureContentProcessing` from `telemetry.ts`.
- **`src/components/messages/messagesWorker.ts`** (UPDATED): Fixed `ingestionMs` double-counting. Writes full per-component telemetry.
- **`src/components/api/statsRoutes.ts`** (UPDATED): Returns per-component latency averages + `queueWaitSamples`.
- **`src/components/dashboard/dashboardRoutes.ts`** (UPDATED): Latency breakdown panel added.
- **`prisma/schema.prisma`** (UPDATED): Added `Stats`, `LatencySample`, `BotEvent`, `ClientSession` models.
- **Desktop version display** (NEW): `Version : {version}` shown in control window via IPC.

**GIF Link Support — `feature/gif-link-support`:**
- `resolveProviderMediaUrl` + `parseOpenGraph` in `content-utils.ts`. Double SSRF validation.

**Security Remediation — `feature/security-remediation`:**
- `src/services/url-guard.ts` (NEW): SSRF guard. `resolveWithinDir` path-traversal guard in `clientRoutes.ts`.

**Presence & Security Hardening — `bugfix/presence-and-security-hardening`:**
- Delta presence model, 3 s debounce. `desktop-client/src/utils.ts` (NEW).

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/broadcastClassifier.ts` | Pure: `classifyDiscordError`, `BroadcastResult`, `persistBroadcastRun`, `mintRunId` |
| `src/services/broadcast.ts` | `broadcastToAllGuilds()` → returns `BroadcastResult[]`; persists run; no swallowed errors |
| `src/components/api/adminDbRoutes.ts` | Owner-only: GET /db/guilds, DELETE /db/guilds/:id, GET /db/broadcasts/latest |
| `src/services/url-guard.ts` | SSRF guard: scheme + IP block-list + DNS check |
| `src/services/content-utils.ts` | Media URL info; YouTube early-return; GIF OG extraction; returns `resolvedUrl` |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo` type; used by all 4 message commands |
| `src/components/client/clientRoutes.ts` | Static client routes; `resolveWithinDir` containment guard |
| `src/components/messages/messagesWorker.ts` | Dequeues messages; writes per-component telemetry |
| `src/components/api/statsRoutes.ts` | GET /api/stats; per-component latency averages |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; latency breakdown; "Base de données" page |
| `src/services/presenceStore.ts` | In-memory presence store |
| `src/loaders/socketLoader.ts` | Socket.IO handler; delta events; 3 s debounce |

---

## 3. Next steps

1. **REVIEWER** `feature/crud-database-dashboard` → awaiting GO/NO-GO on `.pipeline/review.md`.
2. **PR** `feature/crud-database-dashboard` → `develop` (squash merge after reviewer GO).
3. **REVIEWER** `feature/gif-link-support` → awaiting GO/NO-GO on `.pipeline/review.md`.
4. **PR** `feature/gif-link-support` → `develop`.
5. **PR** `feature/security-remediation` → `develop`.
6. **PR** `bugfix/presence-and-security-hardening` → `develop`.
7. **`feature/network-media-optim`** — media by URL, compression, cache.
8. **Observability phase 2** — external log shipping (Loki/ELK).

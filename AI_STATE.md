# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/crud-database-dashboard` — IN PROGRESS (SonarQube Quality Gate fixes applied; 250 tests green, lint clean).

Previous: `hotfix/youtube-regression-1.2.7` — RELEASED as `1.2.8` (stable).
Previous: `feature/gif-link-support` — IN PROGRESS (awaiting REVIEWER).
Previous: `feature/security-remediation` — COMPLETE (REVIEWER GO ✅).

---

## 1. Accomplished (all sprints)

**SonarQube Quality Gate fixes (this session):**
- **`desktop-client/src/main.ts`** (UPDATED): SSRF fix × 2.
  - `app:test-connection`: now stores `assertHttpUrl(backendUrl).href.replace(...)` in `validatedBase`; uses that to build the fetch URL (no more raw tainted string).
  - `app:get-presence`: `settings.backendUrl.replace(...)` → `assertHttpUrl(settings.backendUrl).href.replace(...)`, mirroring `getOverlayUrl()`.
- **`src/services/content-utils.ts`** (UPDATED): ReDoS fix — `parseOpenGraph` outer regex simplified from `/<meta\b([^>]+)(?:\s*\/)?>/gi` to `/<meta\b([^>]*)>/gi`. Removed the optional `(?:\s*\/)?` group that overlapped with `[^>]+` (both could match `/`).
- **`src/__tests__/services/content-utils.test.ts`** (UPDATED): Test duplication fixed.
  - T-1…T-7 (7 separate tests) → one `it.each([label, url, expectedShort])` table.
  - T-10, T-12, T-13 (3 separate tests around line 285) → one `it.each([label, url])` table.
  - T-8, T-9, T-11, T-14, T-15, T-16 kept as-is (distinct behaviors).
  - **Suite: 250 tests — all passing.**

**DB Viewer + Broadcast Logging — `feature/crud-database-dashboard`:**
- `prisma/schema.prisma`: `BroadcastLog` model + migration.
- `src/services/broadcastClassifier.ts`: `classifyDiscordError`, `mintRunId`, `persistBroadcastRun` (fail-safe).
- `src/services/broadcast.ts`: `broadcastToAllGuilds()` returns `BroadcastResult[]`.
- `src/components/discord/announceCommand.ts` / `announceGuildCommand.ts`: structured results + DB logging.
- `src/components/api/adminDbRoutes.ts`: owner-only GET /db/guilds, DELETE /db/guilds/:id, GET /db/broadcasts/latest.
- `src/components/dashboard/dashboardRoutes.ts`: "Base de données" page, guild table, toast, lazy-load.
- Reviewer blockers B-1 (persistBroadcastRun fail-safe) and B-2 (delivered flag ordering) resolved.

**Prior sprints:** YouTube hotfix (1.2.8), GIF/Tenor/Giphy OG extraction, telemetry service, SSRF url-guard, presence delta model — all complete.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/broadcastClassifier.ts` | Pure: `classifyDiscordError`, `persistBroadcastRun` (fail-safe), `mintRunId` |
| `src/services/broadcast.ts` | `broadcastToAllGuilds()` → `BroadcastResult[]`; no swallowed errors |
| `src/components/api/adminDbRoutes.ts` | Owner-only DB admin endpoints |
| `src/services/url-guard.ts` | SSRF guard: scheme + IP block-list + DNS check |
| `src/services/content-utils.ts` | Media URL info; YouTube early-return; GIF OG extraction; ReDoS-safe regex |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo`; used by all 4 message commands |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; latency breakdown; DB page |
| `desktop-client/src/main.ts` | Electron main; `assertHttpUrl` now used at every fetch-URL construction site |

---

## 3. Next steps

1. **REVIEWER** `feature/crud-database-dashboard` → SonarQube gate now clear; re-submit for final GO.
2. **PR** `feature/crud-database-dashboard` → `develop` (squash merge after GO).
3. **REVIEWER** `feature/gif-link-support` → awaiting GO/NO-GO on `.pipeline/review.md`.
4. **PR** `feature/gif-link-support` → `develop`.
5. **PR** `feature/security-remediation` → `develop`.
6. **PR** `bugfix/presence-and-security-hardening` → `develop`.
7. **`feature/network-media-optim`** — media by URL, compression, cache.
8. **Observability phase 2** — external log shipping (Loki/ELK).

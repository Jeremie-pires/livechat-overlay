# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/crud-database-dashboard` — IN PROGRESS (all known bugs fixed; 250 tests green, lint clean).

Previous: `hotfix/youtube-regression-1.2.7` — RELEASED as `1.2.8` (stable).
Previous: `feature/gif-link-support` — IN PROGRESS (awaiting REVIEWER).
Previous: `feature/security-remediation` — COMPLETE (REVIEWER GO ✅).

---

## 1. Accomplished (all sprints)

**Client-side JS syntax fix (this session):**
- **`src/components/dashboard/dashboardRoutes.ts`** (UPDATED): `\n\n` → `\\n\\n` in `deleteGuild`'s `confirm()` call (line 882).
  - Root cause: `\n` inside a TypeScript template literal is processed as an actual newline character. The browser received a literal newline inside a single-quoted JS string → `SyntaxError: Unexpected string` → entire `<script>` block failed to parse → `navigate` undefined.
  - Fix: `\\n\\n` in TS source produces `\n\n` (JS escape sequences) in the browser.

**SonarQube Quality Gate fixes (prior session):**
- **`desktop-client/src/main.ts`**: SSRF fix × 2 (`app:test-connection` + `app:get-presence` — use `assertHttpUrl().href` not raw tainted string).
- **`src/services/content-utils.ts`**: ReDoS fix — `parseOpenGraph` regex `[^>]+(?:\s*\/)?` → `[^>]*`.
- **`src/__tests__/services/content-utils.test.ts`**: T-1…T-7 and T-10/T-12/T-13 → two `it.each` tables.

**DB Viewer + Broadcast Logging — `feature/crud-database-dashboard`:**
- `prisma/schema.prisma`: `BroadcastLog` model + migration.
- `src/services/broadcastClassifier.ts`: `classifyDiscordError`, `mintRunId`, `persistBroadcastRun` (fail-safe).
- `src/services/broadcast.ts`: `broadcastToAllGuilds()` returns `BroadcastResult[]`.
- `src/components/discord/announceCommand.ts` / `announceGuildCommand.ts`: structured results + DB logging.
- `src/components/api/adminDbRoutes.ts`: owner-only GET /db/guilds, DELETE /db/guilds/:id, GET /db/broadcasts/latest.
- `src/components/dashboard/dashboardRoutes.ts`: "Base de données" page, guild table, toast, lazy-load, delete action.
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
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; latency breakdown; DB page (syntax-fixed) |
| `desktop-client/src/main.ts` | Electron main; `assertHttpUrl` used at every fetch-URL construction site |

---

## 3. Next steps

1. **REVIEWER** `feature/crud-database-dashboard` → SonarQube gate clear + JS syntax fix applied; re-submit for final GO.
2. **PR** `feature/crud-database-dashboard` → `develop` (squash merge after GO).
3. **REVIEWER** `feature/gif-link-support` → awaiting GO/NO-GO on `.pipeline/review.md`.
4. **PR** `feature/gif-link-support` → `develop`.
5. **PR** `feature/security-remediation` → `develop`.
6. **PR** `bugfix/presence-and-security-hardening` → `develop`.
7. **`feature/network-media-optim`** — media by URL, compression, cache.
8. **Observability phase 2** — external log shipping (Loki/ELK).

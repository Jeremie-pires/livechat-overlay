# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI green, Sonar CPD fixes applied (sessions 22 + 23, awaiting final analysis).

---

## 1. Accomplished

### Session 23 (Sonar CPD fixes — remaining 4 clones eliminated)
- **Fix D**: `broadcast.ts` — added `applyMaintenanceMode(silentMode)` helper; `dashboardRoutes.ts` now calls it instead of inline upsert+broadcast block (eliminated clone [29])
- **Fix C**: `discord-utils.ts` — added `assertAdminPermission(interaction, discordClient)` + `createSetGuildTimeCommand(opts)` factory; `setDefaultTimeCommand.ts` and `setMaxTimeCommand.ts` rewritten as thin wrappers; `setupCommand.ts` uses `assertAdminPermission` (eliminated clones [32][33][34])
- All 386 tests pass, no new TS errors in new files

### Session 22 (CI fix + Sonar CPD fixes A+B)
- **CI fix**: `adminDbRoutes.test.ts` — added `checkRouteAuth` and `requireAuth` to the session mock (DELETE route tests crashing 500 → all pass)
- **Fix A**: `content-utils.ts` — extracted `fetchWithTimeout` helper (eliminated 51-token Promise.race clone)
- **Fix B**: `session.ts` — exported `requireAuth` Fastify preHandler; `adminDbRoutes.ts` + `dashboardRoutes.ts` use `{ preHandler: requireAuth }` (eliminated 57-token inline auth clone)

### Sessions 17–21 (Sonar: 7.6% → 4.7% → identified root causes)
- Various CPD fixes: `ytdlp.ts` deduplication, `commandHelpers.ts` extraction, `renderer.js` extraction
- jscpd at 50 tokens → found/identified remaining clones

---

## 2. Architecture actuelle

| Fichier | Rôle |
|---|---|
| `src/services/discord-utils.ts` | `assertAdminPermission` + `createSetGuildTimeCommand` factory |
| `src/components/discord/setDefaultTimeCommand.ts` | thin wrapper → `createSetGuildTimeCommand` |
| `src/components/discord/setMaxTimeCommand.ts` | thin wrapper → `createSetGuildTimeCommand` |
| `src/components/discord/setupCommand.ts` | uses `assertAdminPermission` from discord-utils |
| `src/services/broadcast.ts` | `broadcastToAllGuilds` + `applyMaintenanceMode(silentMode)` |
| `src/components/dashboard/dashboardRoutes.ts` | POST toggle calls `applyMaintenanceMode` |
| `src/services/session.ts` | `checkRouteAuth` + `requireAuth` preHandler |
| `src/components/api/adminDbRoutes.ts` | DELETE uses `{ preHandler: requireAuth }` |
| `src/services/content-utils.ts` | `fetchWithTimeout` helper + `getAudioInfoFromUrl` |
| `src/services/ytdlp.ts` | `extractVideoUrl` + `extractAudioUrl` via `deduplicatedExtract` |

---

## 3. Next Steps

### [WAITING — Sonar re-analysis]
- Push triggers new CI + SonarCloud analysis on PR #74
- Expected: duplication on New Code drops to ≤ 3% (threshold)
- If still > 3%: run jscpd --min-tokens 50 on src diff files and find remaining clones

### [MANUAL — user action required]
- Security Rating C (Dockerfile pip hotspot) — navigate to SonarCloud → hotspot → acknowledge as "Safe"

### [AFTER SONAR PASSES]
- Merge `develop → main` (PR #74)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio`

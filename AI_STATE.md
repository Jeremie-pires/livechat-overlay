# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI fixed, Sonar CPD fixes applied (awaiting new analysis).

---

## 1. Accomplished

### Session 22 (CI fix + Sonar CPD fixes)
- **CI fix**: `adminDbRoutes.test.ts` — added `checkRouteAuth` and `requireAuth` to the session mock (DELETE route tests were crashing with 500 because `checkRouteAuth` was undefined in the mock → all 8 tests now pass)
- **Fix A**: `content-utils.ts` — extracted `fetchWithTimeout(pinnedUrl, pinnedInit, timeoutMs, timeoutMsg)` helper; replaced both `Promise.race([fetch, setTimeout])` blocks (redirect loop lines 130-134 and `getAudioInfoFromUrl` lines 527-534) with it
- **Fix B**: `session.ts` — exported `requireAuth` Fastify preHandler; `adminDbRoutes.ts` DELETE and `dashboardRoutes.ts` POST now use `{ preHandler: requireAuth }` instead of inline `checkRouteAuth + if (!auth.ok)` pattern

### Session 21 (Sonar diagnostics — root cause identified)
- Ran jscpd at 50 tokens → found exactly TWO ≥50-token clones involving PR-changed new code (now fixed in session 22)

### Session 20 (develop — Sonar duplication 4.7% → stuck)
- `ytdlp.ts`: extracted `deduplicatedExtract(key, factory)`
- `session.ts`: added `error: string` to `AuthCheckResult`

### Sessions 17–19 (Sonar fixes: 7.6% → 5.5% → 5.1% → 4.9% → 4.7%)
- `content-utils.audio.test.ts`: refactored; CPD exclusions added
- `commandHelpers.ts`: `createTalkQueueEntry`, `resolveTTSAttachment` extracted
- `renderer.js`: `syncBaseSettingsToElements()` extracted

---

## 2. Architecture actuelle

| Fichier | Rôle |
|---|---|
| `src/components/client/client.html` | `generateAudioVideo` — native `<video>` si `muteVideo=true`, Vidstack sinon |
| `src/services/content-utils.ts` | `fetchWithTimeout` helper + `getAudioInfoFromUrl` — SSRF + YouTube yt-dlp + direct audio HEAD |
| `src/services/ytdlp.ts` | `extractVideoUrl` + `extractAudioUrl` via `deduplicatedExtract`. `--js-runtimes node`. |
| `src/components/messages/commandHelpers.ts` | Helpers extraits: `executeMessageHandler`, `resolveTTSAttachment`, `createTalkQueueEntry`, `replyError` |
| `src/services/session.ts` | `checkRouteAuth` + `requireAuth` preHandler Fastify |
| `src/components/api/adminDbRoutes.ts` | DELETE uses `{ preHandler: requireAuth }` |
| `src/components/dashboard/dashboardRoutes.ts` | POST `/api/maintenance/toggle` uses `{ preHandler: requireAuth }` |
| `Dockerfile` | `node:22-alpine`, `yt-dlp yt-dlp-ejs` via pip `--only-binary :all:` |

---

## 3. Next Steps

### [WAITING — Sonar re-analysis]
- Push triggered new CI run; await SonarCloud analysis on PR #74
- If duplication still > 3%: run jscpd at 50 tokens on all src files and identify remaining clones

### [MANUAL — user action required]
- Security Rating C (Dockerfile pip hotspot) — navigate to SonarCloud → hotspot → acknowledge as "Safe"

### [AFTER SONAR PASSES]
- Merge `develop → main` (PR #74)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio`

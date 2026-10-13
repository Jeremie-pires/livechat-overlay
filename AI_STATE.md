# AI_STATE.md — LiveChat CCB

## Status
Branch `develop`. PR #75 (`develop → main`) merged. SonarCloud Quality Gate **failed**: 8.8% duplication on New Code (limit ≤ 3%). Duplication fix pushed → PR #77 gate **green** (new dup 0.0%). Session 31: video volume fix pushed to `develop`, awaiting manual test in desktop app.

---

## 1. Accomplished

### Session 31 (video volume ignored app setting)
- Bug: videos (mp4/TikTok via Cobalt/YouTube via Vidstack) started at 100% ignoring app volume; slider during playback worked.
- Root cause (Vidstack 1.12.13 source): `player.volume` set before can-play is queued, then can-play applies `storage?.getVolume() ?? props.volume` (default 1) → override. Desktop `can-play` handler never re-applied volume (`!isDesktop` only). `storage` default is `null` (no localStorage persistence — old comments were wrong, fixed).
- Fix: new `src/components/client/playerVolume.js` (`clampVolume`, `buildPlayerOptions` with `volume` create prop, `applyPlayerVolume`) used by `client.html` (`__setVolume`, create, can-play for all clients). `clientRoutes.ts`: static assets via `STATIC_ASSETS` table (+ `/playerVolume.js`).
- Tests: `playerVolume.test.ts` (Prove-It: fails without fix), route tests in `clientRoutes.test.ts`. 401/401 pass.
- Iframe fallbacks (TikTok/Twitter) cannot be volume-controlled (cross-origin); TikTok already `muted=1`.

### Session 30 (Sonar duplication fix + Sonar tooling)
- Root cause (via local `jscpd`): `talkCommand.ts` ≈ `hidetalkCommand.ts` (~32 duplicated lines).
- `commandHelpers.ts`: added `buildTalkCommandData(prefix)` + `executeTalkHandler(interaction, { prefix, ephemeral, withAuthor })` (same pattern as `buildMessageCommandData` / `executeMessageHandler`). `resolveTTSAttachment` / `createTalkQueueEntry` now module-private. Extracted `buildAuthorData()` (was duplicated in message + talk queue creation).
- `talkCommand.ts` / `hidetalkCommand.ts`: reduced to 9-line wrappers.
- Local checks: jscpd 1.11% → 0.59% (remaining clones in files untouched by PR); vitest 386/386; eslint clean on changed files; tsc error count unchanged vs baseline (43, all pre-existing / partial local install).
- `CLAUDE.md`: new section "SonarCloud Quality Gate — must stay green" (pre-push jscpd + lint/tsc/tests, ask user for Sonar result after push, never merge red gate). Also contains uncommitted "Skills priority — agent-skills" section.
- SonarQube MCP server registered (local scope, `~/.claude.json`, not in repo): `docker run -i --rm --init --pull=always -e SONARQUBE_TOKEN -e SONARQUBE_ORG=jeremie-pires sonarsource/sonarqube-mcp`. Token read from user env var only. Now **connected**: project key `Jeremie-pires_livechat-overlay`, PR #77 gate = ERROR (new dup 8.8%, all other conditions OK).
- Found: SonarCloud uses **Automatic Analysis** (no scanner in CI) → reads `.sonarcloud.properties`, ignores `sonar-project.properties`. Our CPD exclusions were never applied (e.g. `presenceStore.ts` flagged as clone of its test). Added `.sonarcloud.properties` with the same `sonar.cpd.exclusions`.

### Session 29 (5-axis code review + mass fix)
- 17 files fixed: OAuth validation, SSRF guard on video proxy, cookie sanitisation, `hashToken` dedup, TTS temp files in `os.tmpdir()`, timers `.unref()`, dead env code removed, typed globals.

### Session 28
- VidstackPlayer error handler; CDN domain logging for TikTok proxy failures.

---

## 2. Current State

| Item | State |
|---|---|
| main | PR #75 merged — Sonar gate red (duplication) |
| Working tree | Clean — session 31 pushed to `develop` |
| Sonar access | SonarQube MCP connected (`SONARQUBE_TOKEN` user env var) |
| Local env | `node_modules` installed via `npx pnpm@9` (`zlib-sync` native build failed — non-blocking for tests). No global `pnpm`. Files are CRLF locally; lint with `endOfLine: auto` |
| Prod containers | `livechatccb` (3000) + `cobalt` (9000) |
| TikTok CDN | Root cause unconfirmed, needs `cdnDomain` log |

---

## 3. Next Steps

### [IMMEDIATE]
1. User: manual test of volume fix in desktop app (volume 20% → mp4, YouTube, TikTok start at 20%).
2. Check Sonar gate on the PR containing session 31 via MCP → green before merge to `main`.

### [AFTER]
- VPS: `git pull && docker compose up --build -d`; send TikTok command, check `cdnDomain` log; if `*.tiktokcdn*.com` → fix `parseCookiesForDomain`.

### [LATER]
- `presenceStore.test.ts` reimplements the store instead of importing it — rewrite test against real module.
- Pre-existing clones (not New Code): `announceCommand`/`announceGuildCommand`/`maintenanceCommand`, `statsRoutes`/`dashboardRoutes` session check, `client.html` 373/765.
- H-AUD-06: 4 commands store `media` in DB instead of `audio`.
- S-1: CSP nonce to replace `unsafe-inline` in dashboard.

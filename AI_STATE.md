# AI_STATE.md — LiveChat CCB

## Status
Branch `develop`. Commit `63ec9e3` — volume burst fix + OBS volume support. 416/416 tests pass. Awaiting manual desktop test + Sonar gate check before merge to `main`.

---

## 1. Accomplished

### Session 32 (desktop volume burst fix + OBS volume)
- **Root cause**: `buildPlayerOptions` had `muted: !isDesktop = false`. Vidstack autoplayed at 100% before `can-play` applied `currentVolume`. OBS/browser unaffected (already `muted: true`).
- `playerVolume.js`: `muted: true` always; removed `isDesktop` param.
- `client.html` `can-play`: order now `applyPlayerVolume → unmute → play`. Defensive volume+unmute added immediately after `VidstackPlayer.create()`.
- `commandHelpers.ts` `computeFinalDuration`: priority now `custom → audioDuration → mediaDuration`.
- OBS volume: `volumeFromUrlParams` reads `?volume=XX`; `currentVolume` init from URL; `socket.on('set-volume')` wired. `local-server.ts`: `activeVolume` var, OBS URL includes `&volume=XX`, `setLocalServerVolume()` exported. `main.ts`: calls `setLocalServerVolume` + sends updated OBS URL on slider/settings change.
- +15 tests (commandHelpers × 8, volumeFromUrlParams × 7). 416/416 pass.

### Session 31 (playerVolume.js created)
- `playerVolume.js`: `clampVolume`, `buildPlayerOptions` (volume create prop), `applyPlayerVolume`.
- `client.html`: `__setVolume`, `can-play` applies volume for all clients.
- `clientRoutes.ts`: static asset serving for `/playerVolume.js`.

### Session 30 (Sonar duplication)
- `commandHelpers.ts`: `buildTalkCommandData`, `executeTalkHandler` (dedup talk/hidetalk).
- `.sonarcloud.properties` added (Automatic Analysis reads this, not `sonar-project.properties`).

### Sessions 28–29
- VidstackPlayer error handler; SSRF guard; OAuth validation; TTS tmpdir; typed globals.

---

## 2. Current State

| Item | State |
|---|---|
| Branch | `develop`, clean working tree, ahead of `origin/develop` by 1 commit |
| Tests | 416/416 vitest |
| Sonar | MCP connected (`SONARQUBE_TOKEN` env var), project `Jeremie-pires_livechat-overlay` |
| Local env | `npx pnpm@9`, CRLF files, `endOfLine: auto` in eslint |
| Prod | `livechatccb` :3000 + `cobalt` :9000 |
| TikTok CDN | Unconfirmed, needs `cdnDomain` log from prod |

### Key files changed in session 32
- `src/components/client/playerVolume.js` — `muted: true`, `volumeFromUrlParams`
- `src/components/client/client.html` — `can-play` order, `volumeFromUrlParams` init, `set-volume` socket
- `src/components/messages/commandHelpers.ts` — `computeFinalDuration` priority
- `desktop-client/src/local-server.ts` — `activeVolume`, `setLocalServerVolume`, URL param
- `desktop-client/src/main.ts` — calls `setLocalServerVolume` in `overlay:set-volume` + `app:save-settings`
- `src/__tests__/components/messages/commandHelpers.test.ts` — new
- `src/__tests__/components/playerVolume.test.ts` — updated

---

## 3. Next Steps

### [IMMEDIATE]
1. Manual test: set volume 20%, send mp4/YouTube/TikTok → no burst, audio at 20% from frame 1.
2. Sonar gate on the PR → must be green before merge to `main`.
3. Code review pass (`tasks/todo.md` Task 8).
4. VPS: `git pull && docker compose up --build -d`.

### [LATER]
- TikTok CDN: check `cdnDomain` prod log; if `*.tiktokcdn*.com` → fix `parseCookiesForDomain`.
- `presenceStore.test.ts` — rewrite against real module (not reimplementation).
- Pre-existing clones: `announceCommand/Guild/maintenance`, `statsRoutes/dashboardRoutes` session check.
- H-AUD-06: 4 commands store `media` in DB instead of `audio`.
- S-1: CSP nonce to replace `unsafe-inline` in dashboard.

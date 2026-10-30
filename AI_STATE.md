# AI_STATE.md — LiveChat CCB
_Updated: 2026-10-30_

## Done

### Session 34 — Overlay connection bug (RESOLVED) + auth error UX

- **Overlay socket bug**: Fixed — WS now connects (cause unconfirmed, likely UA strip + local socket.io client + WS-only transport combined).
- **Manual validation**: token auth reject confirmed in logs (`level:40` warn), `/msg` works, preview format buttons work, TTS/stop/SSRF/maxMediaTime pending full user test.
- **auth:error feedback**: Server now emits `auth:error` on invalid/missing token. Full chain: `socketLoader.ts` → `client.html` listener → `overlay-preload.ts` IPC → `main.ts` handler → `preload.ts` `onAuthError` → `renderer.js` toast notification.

### Session 35 — OBS browser source fix (rc.9 → rc.12)

- **RC.9**: Remote socket transport changed to `['websocket']` only (Cloudflare fix).
- **RC.10**: `RemoteStatusEvent` type + `onRemoteStatus` IPC chain for auth/connect errors → toast in renderer.
- **RC.11**: `/socket.io/socket.io.js` now proxied from backend in `local-server.ts` — root cause of `io is not defined` on OBS browser source. HTTP handler updated to only skip Socket.IO transport paths (not the client library); `proxyAsset` allowlist extended to include `/socket.io/socket.io.js`.
- **RC.12**: Synthesize `server:status { botOnline: true }` locally on first `new-message` if backend status was never cached — fixes OBS overlay stuck at `opacity: 0` because `server:status` from backend arrived before OBS browser source connected.
- **Debug overlay**: `?debug=1` param added to `client.html` showing socket state in real-time (revealed `io is not defined` error).
- **Pre-release CI rule**: RC tags (`-rc.N`) automatically marked as GitHub pre-release by CI; documented in `CLAUDE.md`.

### Session 36 — OBS audit: real root cause found

- **Root cause**: in the packaged desktop app, `/socket.io/socket.io.js` on the local OBS server returned 503. Since 1.3.2 the main process is bundled by esbuild and `node_modules` is excluded from the ASAR, so socket.io has no `client-dist` file to serve. `client.html` had been switched from the CDN script to the same-origin path (`e28145b`), so `io` was never defined and OBS never connected. Works from sources, fails packaged.
- **Why rc.11 proxy never worked**: engine.io intercepts every `/socket.io/` path before the local HTTP handler (`serveClient: false` still answers 400), so the proxy in `235e24d` was dead code. It is removed.
- **Fix (A)**: `client.html` loads socket.io from the CDN again (as in 1.3.1). `client.html` is served by the backend, so the dev backend must be redeployed for OBS to benefit; no new desktop build is needed to test.
- **Also confirmed**: the old local server never replayed `server:status` (fixed by the `lastServerStatus` cache since rc.12); the backend returns no `Access-Control-Allow-Origin` for `http://localhost:3001`; clock skew between PC and backend is negligible.

## Current state

`develop` branch at `v1.3.2-rc.12`. Fix A committed locally, not pushed or deployed. Stable users are on 1.3.1 (`main` untouched).

## Next steps

1. Redeploy the dev backend, open `/client?guildId=…&debug=1` in Chrome via the local OBS server, send an image and a video, read the console.
2. Check whether `/api/video` is blocked by CORS from the `localhost:3001` origin (backend rejects it); fix if confirmed.
3. Cleanup (B), one rc per step with a test each: statut `botOnline:true` synthesized in `local-server.ts`, Electron UA strip, forced WebSocket transport on the overlay, `?debug=1` overlay (keep or drop).
4. Make the local server answer `sync-time` with the backend clock (low priority).
5. Merge `develop` → `main` + deploy to prod (clear `ClientSession` table before schema push — `prisma/clear-sessions.sql`).
6. Bump `desktop-client/package.json` to `1.3.2` (stable), create annotated tag → CI builds Electron stable release.
7. Complete remaining manual validation: SSRF block, TTS, stop, maxMediaTime clamping.

## Open issues

- Task 17: `noImplicitAny: true` in tsconfig (skipped, non-trivial).
- Task 18: Remove 6 `@ts-ignore` (need type augmentation for `discordClient.commands`).
- Task 21: Extract `requireSession` preHandler (5 duplications).
- Task 22: Embed color constants (~30 hardcoded hex values).
- Logic bugs backlog: `/hidetalk`, FIFO order, `busyUntil` reset.
- `presenceStore.test.ts` rewrite against real module.
- TikTok CDN: check `cdnDomain` prod log to confirm cookie fix works.
- Electron v33 EOL: upgrade needed (separate ticket).
- Prod deployment: `ClientSession` table must be cleared before `prisma db push` (unique constraint changed); use `prisma/clear-sessions.sql`.
- `server:status` not reaching OBS: explained. The old local server did not cache it (fixed in rc.12); the main OBS failure was the missing socket.io client (session 36).

## Decisions

- 2026-10-28 Socket auth requires DB token lookup on every join — avoids stateful in-memory token map, consistent with Prisma session model.
- 2026-10-28 `discordUserId String @unique` instead of `@@unique([discordUserId, guildId])` — one active token per user globally simplifies revocation and avoids stale multi-guild sessions.
- 2026-10-28 zod CVE-2023-54404 suppressed in `.trivyignore` — fix requires zod v4 (breaking API change); accepted risk pending migration.
- 2026-10-28 Prisma binary invoked directly (`/app/node_modules/.bin/prisma`) not via `node` or shell PATH — the `.bin/prisma` file is a shell wrapper, not a JS entry point.
- 2026-10-28 VPS SQLite dev DB at `/data/sqlite-dev.db` (not `/data/sqlite.db`) — separate volume for dev container.
- 2026-10-29 `auth:error` socket event propagated full chain to Electron toast — uses existing `showStatusToast('error', ...)` infrastructure.
- 2026-10-29 OBS browser source loads `client.html` via `local-server.ts` on `localhost:3001`; PC overlay connects directly to backend URL — two separate paths.
- 2026-10-30 socket.io client for `client.html` comes from the CDN, not the local server: a packaged ASAR has no `client-dist`, and engine.io intercepts `/socket.io/*` anyway. Do not reintroduce a same-origin socket.io.js for OBS.
- 2026-10-30 RC.12 synthesizes `server:status { botOnline: true }` on first `new-message` in local-server — workaround for backend sending status before OBS browser source connects; real status from backend still overrides it.

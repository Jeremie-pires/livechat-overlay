# Project state
_Updated: 2026-10-30_

## Done
- Validated in OBS by the user: attachments, TikTok and Twitter all play.
- Diagnosed TikTok/Twitter failure in the OBS browser source. Dev backend logs show yt-dlp (TikTok) and cobalt (Twitter) resolve successfully, then `[CORS] Rejected origin` for `http://localhost:3001`.
- Cause: `corsOrigin` in `src/server.ts` only allows the origin of `API_URL`.
- Fix: CORS logic extracted to `src/services/cors.ts`. A per-request delegator allows `http://localhost:3001` only on `/api/video` (GET/OPTIONS, no credentials, `Range` allowed, `Content-Range` exposed). Other routes are unchanged. Covered by `src/__tests__/services/cors.test.ts`.

## Current state
`develop` at `v1.3.2-rc.12`, dev backend up. OBS shows attachments and other videos. CORS fix committed on `develop`, deployed on the dev backend and validated in OBS (attachments, TikTok, Twitter). Stable users are on 1.3.1 (`main` untouched).

## Next steps
1. Cleanup (B) one rc per step: synthesized `botOnline`, UA strip, forced WebSocket transport, `?debug=1` overlay.
2. Merge `develop` → `main` via PR (SonarCloud green), deploy prod (clear `ClientSession` first), tag `1.3.2` stable.
3. Finish manual validation: SSRF, TTS, stop, maxMediaTime.

## Open issues
- Tasks 17, 18, 21, 22 (`noImplicitAny`, 6 `@ts-ignore`, `requireSession` preHandler, embed colors).
- Logic bugs backlog: `/hidetalk`, FIFO order, `busyUntil` reset.
- `presenceStore.test.ts` rewrite; Electron v33 EOL.
- TikTok CDN: confirm cookie fix via the `cdnDomain` prod log.
- The CI only pushes the image: the dev backend is redeployed by hand (`git pull` + `docker compose -f docker-compose.dev.yml up -d --build`).
- Local server `sync-time` should use the backend clock (small OBS delay).

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
- 2026-10-30 `/api/video` failure from OBS is a CORS rejection of `http://localhost:3001`, not an extraction failure — the fix belongs in the backend CORS policy, not in yt-dlp/cobalt.

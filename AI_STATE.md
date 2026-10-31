# Project state
_Updated: 2026-10-31_

## Done
- Released 1.3.2: `develop` merged into `main`, annotated tag `v1.3.2` pushed, desktop release CI triggered.
- OBS TikTok/Twitter fixed: CORS allows the local overlay origin on `/api/video` only (`src/services/cors.ts`), validated in OBS.
- SonarCloud gate fixed: actions pinned to a SHA, SRI on the socket.io CDN script, UA regex linearized. `?debug=1` overlay removed.
- Prod database backed up, `ClientSession` emptied.

## Current state
`main` and the tag are at 1.3.2, so stable desktop users will auto-update. The prod backend is healthy after the one-time `prisma db push --accept-data-loss`, and the desktop release was checked. The `full` duration fix is committed on `develop` but not pushed nor deployed: with a URL, `full` still fails in prod with "between 1 and 3600 seconds".

## Next steps
1. Push the `full` duration fix (committed on `develop`, with regression tests) and redeploy the backend by hand.
2. Finish manual validation: SSRF, TTS, stop, maxMediaTime.

## Open issues
- Tasks 17, 18, 21, 22; logic bugs (`/hidetalk`, FIFO, `busyUntil`); `presenceStore.test.ts`; Electron v33 EOL.
- TikTok CDN cookie fix to confirm in prod logs.
- The CI only pushes the image: backends are redeployed by hand.
- Local server `sync-time` should use the backend clock.

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
- 2026-10-30 Cleanup (B) limited to the `?debug=1` overlay — the `botOnline` synthesis, UA strip and WebSocket-only transport stay until each can be retested on a packaged build; removing them blind risks breaking OBS or the Cloudflare path.
- 2026-10-30 Third-party actions are pinned to a commit SHA and CDN scripts carry SRI — SonarCloud fails the security gate otherwise.
- 2026-10-31 A custom duration is checked twice: numeric values before content extraction (no yt-dlp call for a typo), `full` after it (needs the URL's duration). `full` is capped at 3600 s like numeric values — the client never plays longer, and an uncapped value kept the guild busy after playback ended.
- 2026-10-31 `full` on content without a duration (image, text) still answers with the generic "between 1 and 3600 seconds" message — a dedicated message needs a new i18n key, deferred.
- 2026-10-31 SSRF audit: `url-guard` now also blocks 0/8, 192.0.0/24, 198.18/15, 224+/240+, IPv6 multicast and 6to4 wrapping a private IPv4. Two blind or low-risk gaps are accepted: ffprobe follows HTTP redirects (only a duration leaks; piping the stream would break mp4 files with a trailing index) and `/api/video` follows CDN redirects (the URL comes from yt-dlp/cobalt on whitelisted hosts).
- 2026-10-30 The prod schema change needs `prisma db push --accept-data-loss` once, after emptying `ClientSession` — the startup `db push` refuses the new unique constraint without the flag.

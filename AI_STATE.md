# Project state
_Updated: 2026-11-01_

## Done
- Audit of the open tasks, merged into `main` via PR #81 (CI and SonarCloud gate green):
  - `full` duration now works with a URL, is capped at 3600 s, and a malformed duration is rejected before content extraction.
  - The worker plays each guild's messages in FIFO order.
  - The SSRF guard blocks reserved, multicast and 6to4 ranges.
  - `presenceStore.test.ts` tests the real module instead of an inline copy.
- The overlay player now starts at the app volume: Vidstack re-applied its default volume (100%) right after `can-play`, so the volume is set as an attribute on the target before `VidstackPlayer.create`. Raising the volume from 0 also unmutes the player.
- `full` now works with a YouTube link (duration fetched through yt-dlp only when `full` is used) and with an audio track (the audio duration takes priority, as in `computeFinalDuration`).
- `/hidetalk` was already fixed (it defers its reply through `executeTalkHandler`); the issue is closed.

## Current state
`main` holds release 1.3.2 plus PR #81. `develop` adds the player volume fix and the YouTube/audio `full` fix; both change the backend only (the overlay page is served by the backend), so no desktop release is needed. Prod still runs the backend from before PR #81. The suite has 491 passing tests.

## Next steps
1. Merge `develop` into `main`, redeploy the backend by hand, then check: `/send` with a YouTube link and `full` (in the link and in the audio field), a video at 10% volume starting quietly, and 3 messages in a row in one guild playing in order.
2. Desktop side, needs a release: send the current volume to OBS when its socket connects (it falls back to the volume in the copied URL), and add `volume` to the PC overlay URL.

## Open issues
- `busyUntil` logic bug: the symptom is not documented yet.
- Undecided: should `/stop` be restricted to admins? The code has no permission check.
- Tasks 17, 18, 21, 22; Electron v33 is end of life.
- `Queue.busyRequeueMs` is no longer used; dropping it needs a schema migration.
- The socket `disconnecting` debounce in `socketLoader.ts` has no test.
- The TikTok CDN cookie fix is still to confirm in prod logs.
- CI only pushes the image; backends are redeployed by hand.

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
- 2026-10-31 The worker skips busy guilds when selecting the next message instead of requeuing it at `now + 250 ms`: requeuing reshuffled a guild's messages. `executionDate` is never rewritten. Backpressure is now `previous busyUntil − executionDate`, computed at claim time.
- 2026-10-31 The local OBS server keeps answering `sync-time` with the PC clock, not the backend clock. The drift is under a second with Windows NTP sync and the 1.2 s display lead absorbs it; a fix would need a desktop release and an OBS retest for no visible gain.
- 2026-11-01 The initial player volume goes through the `volume` attribute of the target element: Vidstack 1.12.13 only reads props at setup, and the `volume`/`muted` options of `create()` only queue a request that `can-play` overwrites with the default.
- 2026-11-01 A YouTube link's duration is fetched with yt-dlp only for `full`, to avoid adding a yt-dlp call to every YouTube message.
- 2026-10-30 The prod schema change needs `prisma db push --accept-data-loss` once, after emptying `ClientSession` — the startup `db push` refuses the new unique constraint without the flag.

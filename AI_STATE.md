# AI_STATE.md — LiveChat CCB
_Updated: 2026-10-29_

## Done

### Session 33 — Security + quality audit (PR #79, merged to main)

- **Critical bugs**: `requireAuth` converted to async; `parseDuration('full', null/undefined)` returns `'error'`; `AbortSignal.timeout(10_000)` + Content-Length > 50 MB guard in `content-utils.ts`; channel-check wrapped in try/catch in `DiscordLoader.ts`.
- **Socket token auth**: `ClientSession` schema changed to `discordUserId String @unique` (one active token per user globally); `socket.join` moved after token validation; no token or wrong guild → rejected with warn log.
- **Server hardening**: Docker ports bound to `127.0.0.1`; SSRF blocklist extended (CGNAT, NAT64, `fec0::/10`); `maxMediaTime` enforced unconditionally at dequeue.
- **Electron hardening**: CORS restricted to `null`/`http://localhost:*`; `esc()` XSS guard on changelog; `will-navigate` blocks non-localhost URLs; `setPermissionRequestHandler` denies camera/mic/notifications.
- **Code quality**: `start` script fixed; 7 dead deps removed; `CLAUDE.md` updated; dead workflow/config files deleted; 40 new tests added (456/456 pass).
- **CI fixes**: `eslint-plugin-import` bumped to `2.31.0`; pnpm lockfile regenerated (v8); `MockLogger` unused type removed; zod CVE-2023-54404 added to `.trivyignore`; `pnpm run generate` step added to `release.yml`.
- **VPS dev deployed**: `git pull` → `docker compose -f docker-compose.dev.yml up --build -d` → schema migration via `docker compose run --rm livechatccb-dev /app/node_modules/.bin/prisma db push --accept-data-loss` → bot online as "Livechat dev#5585".

### Session 34 — Overlay connection bug (develop)

- **Root cause**: overlay window's socket never connects → `showOverlay()` never called → opacity 0 → nothing displays. Socket.io client was loaded from `cdn.socket.io` CDN which may be blocked in Electron context (Cloudflare UA-based bot filtering).
- **Fix 1** (`client.html`): replaced CDN script tag with `/socket.io/socket.io.js` served by the same-origin server. Eliminates external CDN dependency.
- **Fix 2** (`desktop-client/src/main.ts`): strips `Electron/X.X.X` from overlay window UA before loading URL, preventing Cloudflare from flagging socket.io polling requests as bot traffic.
- **Fix 3** (`desktop-client/src/local-server.ts`): added forwarding of `server:status`, `bot:offline`, `server:maintenance` events from remote to local clients (was missing — OBS browser source would also have been broken). Added `lastServerStatus` cache so late-connecting clients get the current status immediately.

## Current state

`develop` has the overlay bug fix pending push/CI. VPS dev confirmed: bot online ("Livechat dev#5585"), `server:status { botOnline: true }` correctly emitted, ClientSession exists for Jerezouz. Server-side is fully healthy. Fix requires: (1) server container redeploy for `client.html`, (2) new Electron build for UA strip + local-server fixes.

## Next steps

1. Push `develop` → CI builds new Docker image → VPS pull + restart dev container.
2. User rebuilds Electron desktop-client (or waits for next release).
3. User reconnects overlay — verify dot green + test format buttons work + `/msg` displays.
4. If UA was the issue: dot green immediately after container restart (server fix alone sufficient).
5. Complete manual validation (token auth, SSRF block, TTS, stop, maxMediaTime clamping).

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

## Decisions

- 2026-10-28 Socket auth requires DB token lookup on every join — avoids stateful in-memory token map, consistent with Prisma session model.
- 2026-10-28 `discordUserId String @unique` instead of `@@unique([discordUserId, guildId])` — one active token per user globally simplifies revocation and avoids stale multi-guild sessions.
- 2026-10-28 zod CVE-2023-54404 suppressed in `.trivyignore` — fix requires zod v4 (breaking API change); accepted risk pending migration.
- 2026-10-28 Prisma binary invoked directly (`/app/node_modules/.bin/prisma`) not via `node` or shell PATH — the `.bin/prisma` file is a shell wrapper, not a JS entry point.
- 2026-10-28 VPS SQLite dev DB at `/data/sqlite-dev.db` (not `/data/sqlite.db`) — separate volume for dev container.

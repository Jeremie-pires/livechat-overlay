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

### Session 34 — Overlay connection bug (RESOLVED) + auth error UX

- **Overlay socket bug**: Fixed — WS now connects (cause unconfirmed, likely UA strip + local socket.io client + WS-only transport combined).
- **Manual validation**: token auth reject confirmed in logs (`level:40` warn), `/msg` works, preview format buttons work, TTS/stop/SSRF/maxMediaTime pending full user test.
- **auth:error feedback**: Server now emits `auth:error` on invalid/missing token. Full chain: `socketLoader.ts` → `client.html` listener → `overlay-preload.ts` IPC → `main.ts` handler → `preload.ts` `onAuthError` → `renderer.js` toast notification.

## Current state

`develop` branch has all session 34 changes committed and pushed. CI in progress. Dev container running (`dev-livechat-overlay-livechatccb-dev-1`). Server-side healthy. Next: prod release once CI green.

## Next steps

1. Wait for CI green on `develop`.
2. Merge `develop` → `main` + deploy to prod (remember: clear `ClientSession` table before schema push — see `prisma/clear-sessions.sql`).
3. Bump `desktop-client/package.json` version, create annotated tag → CI builds new Electron release.
4. Complete remaining manual validation: SSRF block, TTS, stop, maxMediaTime clamping.

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
- 2026-10-29 `auth:error` socket event propagated full chain to Electron toast — uses existing `showStatusToast('error', ...)` infrastructure.

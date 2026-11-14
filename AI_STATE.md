# Project state
_Updated: 2026-11-14_

## Done
- Red dot / dead livechat for some users, mostly in guilds with 4+ connected clients. Cause: `trustProxy: 1` makes Fastify 5 ignore `X-Forwarded-For`, so `req.ip` was the Docker gateway for every request and the 300 req/min rate limit was one bucket shared by all users. When it ran out, the overlay page got a 429, no socket opened, and the app stayed red. Fix on `fix/rate-limit-client-ip`: `trustProxy` is a list of trusted proxies (loopback, Docker bridge, Cloudflare ranges) in `trustedProxies.ts`, and `/client?…` is exempt like `/client/…`.
- PRs #81 and #82 merged into `main`: `full` with URLs, YouTube and audio; FIFO per guild; SSRF ranges; overlay starts at the app volume.

## Current state
Prod: Cloudflare (proxied) → HAProxy on the host → `127.0.0.1:3000` → container. The origin also answered directly on its IP, bypassing Cloudflare. The prod compose file builds the image on the host; the image pushed by CI is not used. The suite has 501 passing tests.

## Next steps
1. Merge `fix/rate-limit-client-ip` once CI and the SonarCloud gate are green, then redeploy the backend (`git pull`, `docker compose build`, `docker compose up -d --wait livechatccb`).
2. After the deploy, check that `x-ratelimit-remaining` starts near 299 for a new client instead of a shared, lower value.
3. Check the PR #82 items in prod: `/send` with a YouTube link and `full`, a video at 10% volume starting quietly, 3 messages in a row playing in order.
4. Desktop, next release: reload the overlay when `/client` does not answer 200 (it stays red today); send the current volume to OBS on connect and add `volume` to the PC overlay URL.

## Open issues
- `server:status` is only sent on socket connection: a client that connects before the Discord bot is ready stays red until it reconnects.
- `GuildDelete` also fires when a guild is only unavailable (Discord outage) and then deletes every client token of that guild.
- `busyUntil` logic bug: symptom not documented. `/stop` has no permission check (undecided).
- Tasks 17, 18, 21, 22; Electron v33 is end of life. `Queue.busyRequeueMs` is unused (needs a migration).
- No test for the socket `disconnecting` debounce. TikTok CDN cookie fix not yet confirmed in prod logs.
- `tsc --noEmit` reports pre-existing errors (test mocks, `content-utils.ts`, `server.ts` error handler).
- Untracked local files (`.agents/`, `.claude/`, `CODE_REVIEW.md`, `main.js`, `skills-lock.json`): versioning not decided.

## Decisions
Older entries: `docs/decisions.md`.
- 2026-11-01 The initial player volume goes through the `volume` attribute of the target element: Vidstack 1.12.13 only reads props at setup.
- 2026-11-01 A YouTube link's duration is fetched with yt-dlp only for `full`.
- 2026-11-14 `trustProxy` lists trusted proxy ranges instead of a hop count. `CF-Connecting-IP` is not used because the origin is reachable without Cloudflare, so the header could be forged.

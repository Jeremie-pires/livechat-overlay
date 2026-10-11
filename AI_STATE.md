# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI green, Sonar Quality Gate **Passed**. Dev tests in progress.

---

## 1. Accomplished

### Session 28 (TikTok silent failure + VidstackPlayer error handler)
- **VidstackPlayer error handler** (`client.html`): `player.addEventListener('error', ...)` → calls `onDone()` immediately instead of blocking the queue for the full duration silently
- **CDN domain logging** (`ytdlp.ts`): logs `cdnDomain` + cookie injection result at debug level
- **Proxy warning enriched** (`videoProxyRoute.ts`): logs `cdnDomain` alongside status on CDN error
- **Root cause suspected**: CDN domain `*.tiktokcdn-us.com` / `*.tiktokcdn.com` doesn't match `.tiktok.com` cookies → proxy fetches CDN without cookies → CDN 403 → proxy 502 → VidstackPlayer silent fail. Awaiting log confirmation.

### Session 27 (429 + 503 overlay fixes)
- Rate limit 100 → 300 req/min; `/client/` exempted from rate limiting
- `bot:offline` Socket.IO event emitted before SIGTERM shutdown (`handleShutdown` moved inside `loadDiscord` closure)
- `#overlay-stage` starts `opacity: 0`; `showOverlay()`/`hideOverlay()` wired to `server:status`, `bot:offline`, `disconnect`
- Lint fix: French apostrophe strings in `handleShutdown` switched to double quotes

### Session 26 (lien+audio)
- Fixed YouTube + separate audio combo: muted iframe + `cc_load_policy=0`

---

## 2. Current State

| Item | State |
|---|---|
| PR #74 | Quality Gate Passed — awaiting dev test sign-off |
| Prod containers | `livechatccb` (port 3000) + `cobalt` (port 9000) |
| Dev containers | Need `git pull && docker compose up --build -d` |
| Dev cobalt port | Change `9000:9000` → `9001:9000` in dev compose if not done |
| TikTok CDN | VidstackPlayer error handler added — root cause (CDN domain cookie mismatch) unconfirmed, needs log |
| Overlay hide/show | Fixed — hides on `bot:offline`/`disconnect`, shows on `server:status.botOnline` |

---

## 3. Next Steps

### [IMMEDIATE]
1. VPS: `git pull && docker compose up --build -d`
2. Send a TikTok command → check logs for:
   - `ytdlp: no cookies matched for CDN domain` → note the `cdnDomain` value
   - `video-proxy: CDN returned error status` → note `cdnDomain` + `status`
3. If CDN domain is `*.tiktokcdn.com` or `*.tiktokcdn-us.com` → fix `parseCookiesForDomain` matching or inject `.tiktok.com` cookies for TikTok CDN requests regardless of domain

### [AFTER TESTS PASS]
- Merge PR #74 (`develop → main`)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio` (type field mismatch)

# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI green, Sonar Quality Gate **Passed**. Dev tests in progress.

---

## 1. Accomplished

### Session 27 (429 + 503 overlay fixes)
- **Rate limit raised** (`server.ts`): 100 → 300 req/min
- **`/client/` exempted** from rate limiting (`utils.ts`) — OBS Browser Source assets no longer consume quota
- **`bot:offline` event** emitted by server on SIGTERM/SIGINT (`DiscordLoader.ts`): `handleShutdown` moved inside `loadDiscord` closure to capture `fastify.io`; broadcasts to all clients before shutdown
- **Overlay hide/show** (`client.html`): `#overlay-stage` starts at `opacity: 0`; `showOverlay()` on `server:status { botOnline: true }`, `hideOverlay()` on `bot:offline` / `disconnect` / `server:status { botOnline: false }`

### Session 26 (lien+audio bug fix)
- **Fixed lien+audio combo** (`client.html`): YouTube URL paired with a separate audio track
  - Fix: muted YouTube iframe + `cc_load_policy=0` to suppress subtitles
- **3 commits pushed**: `1eb4500`, `744199f`, `a9e52f0`

### Sessions 22–25 (Sonar + Dev container)
- All CPD clones eliminated, Quality Gate passed, SonarCloud hotspot accepted
- Dev container built but blocked on port 9000 conflict (prod cobalt holds it)

---

## 2. Current State

| Item | State |
|---|---|
| PR #74 | Quality Gate Passed — awaiting dev test sign-off to merge |
| Prod containers | `livechatccb` (healthy, port 3000) + `cobalt` (port 9000) |
| Dev containers | Need `git pull && docker compose up --build -d` for latest fixes |
| Dev cobalt port | Change `ports: '9000:9000'` → `'9001:9000'` in dev `docker-compose.yml` if not done |
| lien+audio | Fixed — YouTube shown as muted iframe, audio plays via `<audio>` element |
| Rate limit | 300 req/min — `/client/` exempt |
| Overlay 503 | Fixed — overlay hides on `bot:offline`/`disconnect`, shows on `server:status.botOnline` |

---

## 3. Next Steps

### [IMMEDIATE]
1. VPS: `git pull && docker compose up --build -d` in `/home/debian/livechat/dev-livechat-overlay/`
2. Retest lien+audio combo + verify overlay hides/shows on bot restart

### [AFTER TESTS PASS]
- Merge PR #74 (`develop → main`)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio` (type field mismatch)

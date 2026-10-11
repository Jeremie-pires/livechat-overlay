# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI green, Sonar Quality Gate **Passed**. Dev tests in progress.

---

## 1. Accomplished

### Session 26 (lien+audio bug fix)
- **Pushed develop to origin** — all Sonar CPD refactor commits already on `origin/develop`
- **Fixed lien+audio combo** (`client.html`): YouTube URL paired with a separate audio track showed neither video nor sound
  - Root cause: `generateAudioVideo(muteVideo=true)` creates a plain `<video>` element — native `<video>` cannot play YouTube URLs (requires VidstackPlayer or iframe)
  - Fix: added `extractYouTubeId()` helper + dedicated branch in `displayContent` for `mediaContentType === 'video/youtube' && audioUrl` → muted YouTube iframe (`?autoplay=1&mute=1&cc_load_policy=0`)
  - `cc_load_policy=0` added immediately after to suppress auto-generated subtitles
- **3 commits pushed**: `1eb4500` (AI_STATE), `744199f` (fix video), `a9e52f0` (fix subtitles)

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

---

## 3. Next Steps

### [IMMEDIATE]
1. VPS: `git pull && docker compose up --build -d` in `/home/debian/livechat/dev-livechat-overlay/`
2. Retest lien+audio combo on dev bot

### [AFTER TESTS PASS]
- Merge PR #74 (`develop → main`)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio` (type field mismatch)

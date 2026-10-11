# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI green, Sonar Quality Gate **Passed**. Dev container build complete but NOT running (port conflict).

---

## 1. Accomplished

### Session 25 (SonarCloud + Dev container)
- **SonarCloud hotspot accepted**: Navigated to PR #74 issues, accepted Dockerfile yt-dlp unpinned pip hotspot as intentional → Security Rating unblocked → Quality Gate now **Passed**
- **Dev branch corrected**: Dev folder (`/home/debian/livechat/dev-livechat-overlay/`) was on `feature/audio-msg`; checked out `develop` + pulled (30 files, 824 ins, 906 del)
- **Dev image built**: `docker compose down && docker compose up --build -d` completed — image `dev-livechat-overlay-livechatccb` built successfully
- **Blocked**: Dev cobalt (`dev-livechat-overlay-cobalt-1`) can't bind port 9000 — prod cobalt (`livechat-overlay-cobalt-1`) already holds it → dev livechatccb also failed to start

### Sessions 22–24 (Sonar CPD fixes)
- All clones eliminated, Quality Gate passed, see previous sessions for detail

---

## 2. Current State

| Item | State |
|---|---|
| PR #74 | Quality Gate Passed — ready to merge |
| Prod containers | `livechat-overlay-livechatccb-1` (healthy, port 3000) + `livechat-overlay-cobalt-1` (port 9000) |
| Dev containers | Image built, **NOT running** — port 9000 conflict |
| Dev folder | `/home/debian/livechat/dev-livechat-overlay/` on `develop` branch |
| Dev .env | `PORT=3001`, `COBALT_API_URL=http://cobalt:9000` (internal Docker DNS) |
| Dev compose | Cobalt mapped `9000:9000` → conflicts with prod |

---

## 3. Next Steps

### [IMMEDIATE — fix port conflict]
In `/home/debian/livechat/dev-livechat-overlay/docker-compose.yml`:
- Change cobalt `ports: - '9000:9000'` → `'9001:9000'`
- Then: `docker compose up -d`

### [AFTER DEV STARTS]
1. `docker logs dev-livechat-overlay-livechatccb-1 --tail 30` — verify "Livechat dev" bot online
2. Run `/setup channel #bot-test` on dev bot if needed
3. Test all 5 commands via Discord `#🧪・bot-test` on **Livechat dev** bot:
   - `/msg lien` — YouTube URL
   - `/msg texte` — text content
   - `/msg audio` — YouTube audio URL
   - `/msg lien` — TikTok URL
   - `/msg lien` — Twitter/X URL
4. Check `docker logs` after each test for errors

### [AFTER TESTS PASS]
- Merge PR #74 (`develop → main`)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio`

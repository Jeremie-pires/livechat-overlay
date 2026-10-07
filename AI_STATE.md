# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — TikTok H.264 fix validated in dev. Prêt pour PR `develop` → `main` + déploiement prod.

---

## 1. Accomplished

### Session 5 (dev validation TikTok H.264)
- **Fix TikTok audio-only** — `src/services/ytdlp.ts` line 54 : format selector changé de `best[ext=mp4]/best` → `best[ext=mp4][vcodec^=h264]/best[ext=mp4]/best`. Résout la sélection `bytevc1` (H.265, browser-incompatible) au profit de `h264_720p` (H.264, 946x720). Commit `05d9c82`.
- **Validation dev complète** :
  - TikTok : log `"tiktok: yt-dlp extraction succeeded"` + `vcodec=h264 946x720` confirmé
  - Twitter : log `"twitter: cobalt resolution succeeded"` confirmé (session précédente)
- **Dev stack** : `docker compose -f docker-compose.dev.yml` sur VPS (`~/livechat/dev-livechat-overlay/`), port 3001, volume `dev-livechat-overlay_livechat_dev_data`, cobalt-dev sur réseau interne.

### Sessions 3–4 (feature/tiktok-twitter-integration → develop)
- **TikTok URL sanitization** — `sanitizeTikTokUrl` strip query params + chemin post `/video/ID`.
- **Twitter/Cobalt fix** — `isTwitterUrl` accepte `/status/\d+` (sans `/video/N`). `sanitizeTwitterUrl` strip query params + suffixe `/video/N` avant Cobalt.
- **Fix Docker crash** — `fastify.all('/socket.io/*')` → `fastify.route({ method: [...] })`.
- **Fix Trivy CVEs** — `app/node_modules/@esbuild` dans `skip-dirs` de `release.yml`.
- **Fix Docker startup** — `tsx` déplacé en `dependencies`.

### Sessions 1–2
- TikTok CDN 403, proxy Range-aware, iframe fallback, Cobalt pour Twitter.
- Fastify v5 migration, suppression `fastify-socket.io` + `unify-fastify`, SonarQube A, 4 CVE HIGH éliminés.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/server.ts` | Fastify v5 + Socket.IO direct ; `fastify.route()` explicite pour `/socket.io/*` |
| `src/services/content-utils.ts` | `sanitizeTikTokUrl` ; `sanitizeTwitterUrl` ; `isTwitterUrl` = hostname + `/status/\d+` |
| `src/services/ytdlp.ts` | Format `best[ext=mp4][vcodec^=h264]/best[ext=mp4]/best` ; semaphore 5 ; cookie injection |
| `src/services/video-proxy-cache.ts` | Token → CDN entry avec headers |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream proxy Range-aware, try/catch, Cache-Control: no-store |
| `src/services/env.ts` | YTDLP_PATH, FFPROBE_PATH, COBALT_API_URL, COBALT_PUBLIC_URL, API_URL |
| `.github/workflows/release.yml` | skip-dirs inclut `app/node_modules/@esbuild` |

---

## 3. Next Steps

1. **[NEXT]** PR `develop` → `main`
2. **[NEXT]** Déploiement prod : `cd ~/livechat/livechat-overlay && git pull && docker compose build --no-cache && docker compose down && docker compose up -d`
3. Vérifier prod : test TikTok + Twitter via Discord prod bot, confirmer logs
4. **[LATER]** Fix prod 429 sur `/health` (HAProxy marque prod DOWN → 503 NOSRV)
5. **[LATER]** H-AUD-06 — Filtrer `media` (Discord proxy URL) du payload Socket.IO `new-message`
6. **[LATER]** Feature `displayMediaFull`

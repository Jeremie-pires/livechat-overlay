# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — TikTok + Twitter fixes merged to develop. Prêt pour PR `develop` → `main` + déploiement prod.

---

## 1. Accomplished

### Sessions 3–4 (feature/tiktok-twitter-integration → develop)
- **TikTok URL sanitization** — `sanitizeTikTokUrl` strip les query params ET le chemin après `/video/ID`. Résout les 404 yt-dlp causés par `?is_from_webapp=1&sender_device=pc`.
- **Twitter/Cobalt fix** — Cobalt ne supporte pas `/video/N`. `isTwitterUrl` accepte désormais `/status/\d+` (sans exiger `/video/N`). `sanitizeTwitterUrl` strip query params + suffixe `/video/N` avant Cobalt. URL post classique et URL `/video/N` toutes deux acceptées.
- **Fix Docker crash** — `fastify.all('/socket.io/*')` rejeté par `find-my-way` (QUERY dans `http.METHODS` Node 20.14+). Remplacé par `fastify.route({ method: [...] })`.
- **Fix Trivy CVEs** — `app/node_modules/@esbuild` dans `skip-dirs` de `release.yml`.
- **Fix Docker startup** — `tsx` déplacé en `dependencies` (supprimé par `pnpm prune --prod`).

### Sessions 1–2
- TikTok CDN 403, proxy Range-aware, iframe fallback, Cobalt pour Twitter.
- Fastify v5 migration, suppression `fastify-socket.io` + `unify-fastify`, SonarQube A, 4 CVE HIGH éliminés.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/server.ts` | Fastify v5 + Socket.IO direct ; `fastify.route()` explicite pour `/socket.io/*` |
| `src/services/content-utils.ts` | `sanitizeTikTokUrl` (strip params + path) ; `sanitizeTwitterUrl` (strip params + `/video/N`) ; `isTwitterUrl` = hostname + `/status/\d+` |
| `src/services/ytdlp.ts` | yt-dlp -J wrapper, semaphore 5 concurrent, cookie injection |
| `src/services/video-proxy-cache.ts` | Token → CDN entry avec headers |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream proxy Range-aware |
| `src/services/env.ts` | YTDLP_PATH, FFPROBE_PATH, COBALT_API_URL, COBALT_PUBLIC_URL, API_URL |
| `.github/workflows/release.yml` | skip-dirs inclut `app/node_modules/@esbuild` |

### Flow (Discord → browser)
1. Discord `/msg <url>` → `getContentInformationsFromUrl` (sanitize → detect)
2. TikTok: `extractVideoUrl` (yt-dlp) → `buildProxyUrl` → `/api/video?t=TOKEN`
3. Twitter: `resolveCobaltUrl` (URL nettoyée) → `buildProxyUrl` → `/api/video?t=TOKEN`
4. Queue → Socket.IO `new-message` → Vidstack client

---

## 3. Remaining / Next Steps

1. **[NEXT]** PR `develop` → `main` sur GitHub + déploiement prod : `git pull && docker compose build --no-cache && docker compose down && docker compose up -d`
2. **H-AUD-06** — Filtrer `media` (Discord proxy URL) du payload Socket.IO `new-message`
3. **`displayMediaFull`** feature

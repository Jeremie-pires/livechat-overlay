# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/tiktok-twitter-integration` — TikTok + Twitter validés en live (proxy natif). 367 tests verts. Prêt pour PR.

---

## 1. Accomplished

### This session
- **Fix TikTok CDN 403** — cookie injection depuis `cobalt-cookies/cookies.txt` dans le fetch CDN
- **Fix durée TikTok** — `probeDuration` sur l'URL CDN retournait 403 (pas de Cookie) → durée = 0 → vidéo coupée à 5s. Fix : extraire `duration` du JSON yt-dlp `-J` directement
- `src/services/cookies-parser.ts` — nouveau : parse Netscape cookies.txt, filtre par domaine wildcard
- `src/services/ytdlp.ts` — `-g` → `-J`, retourne `{ url, headers, duration? }`, injecte Cookie CDN
- `src/services/video-proxy-cache.ts` — cache porte `headers?: Record<string,string>`
- `src/components/api/videoProxyRoute.ts` — forward headers stockés (Cookie, UA, Referer) vers CDN
- `src/services/content-utils.ts` — TikTok : utilise `extracted.duration` + `extracted.headers`
- `test-cobalt-server.mjs` — cookie injection + durée loggée et exposée dans le status HTML
- `src/__tests__/services/cookies-parser.test.ts` — 7 tests (parse, wildcard, anti-spoofing, ENOENT)
- `src/__tests__/services/content-utils.cobalt.test.ts` — mocks mis à jour + test durée depuis yt-dlp
- **367 tests verts**, lint propre
- **Test live** : TikTok 175s (0:00/2:55, readyState 1) + Twitter 140s (0:00/2:20, readyState 1) ✅

### Previous sessions
- Audit sécurité phase 3, desktop-client v1.3.1, CVE patch x5, CI fix.
- Cobalt (Twitter) + yt-dlp (TikTok) architecture, proxy Range-aware, iframe fallback.
- Repo cleanup: suppression/gitignore tasks/, test-cobalt-server.mjs, desktop-client/package-lock.json, .vscode/launch.json. Déplacement docs infra → docs/infra/. sonar-project.properties + CVE overrides.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/services/cookies-parser.ts` | Parse Netscape cookies.txt → Cookie header string pour un domaine |
| `src/services/ytdlp.ts` | yt-dlp `-J` wrapper — retourne `{ url, headers, duration? }` + cookie injection |
| `src/services/video-proxy-cache.ts` | cache `{ url, headers?, exp }` — token → CDN entry avec headers |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream proxy Range-aware + forward headers |
| `src/services/content-utils.ts` | TikTok → extractVideoUrl → proxy ; Twitter → Cobalt → proxy |
| `cobalt-cookies/cookies.txt` | Cookies TikTok Netscape (gitignored) |

### Flow livechat (Discord → browser)
1. Discord `/send <tiktok-url>` → `sendCommand.ts` → `measureContentProcessing`
2. `getContentInformationsFromUrl` → `extractVideoUrl` (yt-dlp -J) → `findOrCreateProxy` → `proxyUrl`
3. Queue stocke `{ url: proxyUrl, mediaContentType: 'video/mp4', mediaDuration: Xs }`
4. Worker émet `new-message` → client reçoit → `generateAudioVideo(proxyUrl)` → Vidstack joue

---

## 3. Remaining / Next Steps

1. **[NEXT]** PR `feature/tiktok-twitter-integration` → `main`
2. **H-AUD-06** — Socket.IO payload scope : filtrer `media` (Discord proxy URL) du payload `new-message`
3. **Fastify v5 upgrade** — obligatoire pour CVE-2026-76169/84428/84469/84504 (HIGH, tous fixés en v5.12.2 uniquement)
4. **`displayMediaFull`** feature

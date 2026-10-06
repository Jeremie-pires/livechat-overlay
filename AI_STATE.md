# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/tiktok-twitter-integration` — SonarQube fixes + Fastify v5 migration done. Fix Docker crash (fastify.all + QUERY method). Prêt pour PR.

---

## 1. Accomplished

### This session
- **Fix Docker crash** — `fastify.all('/socket.io/*')` en Fastify v5 itère `http.METHODS` qui inclut `QUERY` (Node 20.14+) ; `find-my-way` le rejette. Remplacé par `fastify.route({ method: ['DELETE','GET','HEAD','OPTIONS','PATCH','POST','PUT'], ... })`.
- **Fastify v5 migration** — upgrade `fastify@5.12.5`, `@fastify/cors@^11`, `@fastify/rate-limit@^11`
- **Removed `fastify-socket.io`** — remplacé par intégration Socket.IO directe (`Server.attach(fastify.server)` + `fastify.decorate('io', io)`)
- **Removed `unify-fastify`** — remplacé par `setErrorHandler` inline (était incompatible avec Fastify v5 via `fastify-plugin: '4.x'`)
- **Removed `types-fastify-socket.io`** — devDep supprimée
- **module.d.ts** — supprimé import `socketioServer` depuis `fastify-socket.io`
- **SonarQube duplication fix** — extrait `buildProxyUrl()` et `resolveShortLink()` dans `content-utils.ts` (élimine similarité structurelle `handleTikTokUrl` / `handleTwitterUrl`)
- **SonarQube Security B fix** — ajouté `YTDLP_PATH` et `FFPROBE_PATH` dans `env.ts`; `ytdlp.ts` et `content-utils.ts` utilisent désormais ces vars ; `docker-compose.yml` fixe les chemins absolus Docker
- **tsconfig.json** — supprimé `ignoreDeprecations: "6.0"` invalide
- **4 CVE Fastify HIGH** (CVE-2026-76169, 84428, 84469, 84504) — éliminés via Fastify v5

### Previous sessions
- Fix TikTok CDN 403, durée, proxy natif, 367 tests verts, test live validé.
- Repo cleanup: gitignore, docs/infra, sonar-project.properties, CVE overrides.
- Cobalt (Twitter) + yt-dlp (TikTok) architecture, proxy Range-aware, iframe fallback.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/server.ts` | Fastify v5 + Socket.IO direct (no fastify-socket.io) |
| `src/services/env.ts` | YTDLP_PATH, FFPROBE_PATH, COBALT_* |
| `src/services/cookies-parser.ts` | Parse Netscape cookies.txt → Cookie header |
| `src/services/ytdlp.ts` | yt-dlp -J wrapper (uses env.YTDLP_PATH) |
| `src/services/video-proxy-cache.ts` | Token → CDN entry avec headers |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream proxy Range-aware |
| `src/services/content-utils.ts` | TikTok → yt-dlp → proxy ; Twitter → Cobalt → proxy |
| `cobalt-cookies/cookies.txt` | Cookies TikTok Netscape (gitignored) |

### Flow livechat (Discord → browser)
1. Discord `/send <url>` → `getContentInformationsFromUrl`
2. TikTok: `extractVideoUrl` (yt-dlp -J) → `buildProxyUrl` → proxy
3. Twitter: `resolveCobaltUrl` → `buildProxyUrl` → proxy
4. Queue → `new-message` → client → Vidstack

---

## 3. Remaining / Next Steps

1. **[NEXT]** PR `feature/tiktok-twitter-integration` → `main`
2. **H-AUD-06** — Socket.IO payload scope : filtrer `media` (Discord proxy URL) du payload `new-message`
3. **`displayMediaFull`** feature

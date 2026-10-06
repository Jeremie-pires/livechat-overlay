# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/tiktok-twitter-integration` — Fastify v5 migration + SonarQube fixes + Docker crash fix done. Prêt pour PR vers `main`.

---

## 1. Accomplished

### This session (session 3)
- **Fix Docker crash** — `fastify.all('/socket.io/*')` en Fastify v5 itère `http.METHODS` qui inclut `QUERY` (Node 20.14+) ; `find-my-way` le rejette avec `AssertionError`. Remplacé par `fastify.route({ method: ['DELETE','GET','HEAD','OPTIONS','PATCH','POST','PUT'], ... })`. Commit `c7fead6`.
- **Fix Trivy esbuild CVEs** — `tsx` déplacé en `dependencies` amenait `esbuild` dans l'image prod. Trivy suivait les symlinks pnpm vers `node_modules/@esbuild`. Fix: ajout `app/node_modules/@esbuild` aux `skip-dirs` dans `release.yml`. Commit `1f3deaa`.
- **Fix Docker startup** — `tsx` était devDep, `pnpm prune --prod` le supprimait → `Cannot find module tsx`. Déplacé en `dependencies`.

### Session 2
- **Fastify v5 migration** — `fastify@5.12.5`, `@fastify/cors@^11`, `@fastify/rate-limit@^11`
- **Removed `fastify-socket.io`** — Socket.IO direct : `new SocketIOServer(fastify.server)` + `fastify.decorate('io', io)`
- **Removed `unify-fastify`** — remplacé par `setErrorHandler` inline 6 lignes
- **SonarQube duplication** — `buildProxyUrl()` + `resolveShortLink()` dans `content-utils.ts` ; `runProcess<T>()` dans `spawn-process.ts` partagé entre `content-utils.ts` et `ytdlp.ts`
- **SonarQube Security B→A** — `YTDLP_PATH` + `FFPROBE_PATH` dans `env.ts` ; chemins absolus dans `docker-compose.yml`
- **4 CVE Fastify HIGH** (CVE-2026-76169/84428/84469/84504) éliminés
- **tsconfig** — supprimé `ignoreDeprecations: "6.0"` invalide

### Session 1
- TikTok CDN 403, durée, proxy Range-aware, iframe fallback, Cobalt (Twitter), 367 tests verts.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/server.ts` | Fastify v5 + Socket.IO direct ; `fastify.route()` explicite pour `/socket.io/*` |
| `src/services/env.ts` | YTDLP_PATH, FFPROBE_PATH, COBALT_* |
| `src/services/spawn-process.ts` | `runProcess<T>()` générique — spawn/settle/timeout partagé |
| `src/services/ytdlp.ts` | yt-dlp -J wrapper, semaphore 5 concurrent, cookie injection |
| `src/services/cookies-parser.ts` | Parse Netscape cookies.txt → Cookie header |
| `src/services/video-proxy-cache.ts` | Token → CDN entry avec headers |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream proxy Range-aware |
| `src/services/content-utils.ts` | TikTok → yt-dlp → proxy ; Twitter → Cobalt → proxy |
| `.github/workflows/release.yml` | skip-dirs inclut `app/node_modules/@esbuild` |

### Flow (Discord → browser)
1. Discord `/send <url>` → `getContentInformationsFromUrl`
2. TikTok: `extractVideoUrl` (yt-dlp) → `buildProxyUrl` → `/api/video?t=TOKEN`
3. Twitter: `resolveCobaltUrl` → `buildProxyUrl` → `/api/video?t=TOKEN`
4. Queue → Socket.IO `new-message` → Vidstack client

---

## 3. Remaining / Next Steps

1. **[NEXT]** Valider déploiement dev après fix Docker crash → PR `feature/tiktok-twitter-integration` → `main`
2. **H-AUD-06** — Socket.IO payload scope : filtrer `media` (Discord proxy URL) du payload `new-message`
3. **`displayMediaFull`** feature

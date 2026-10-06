# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/tiktok-twitter-integration` — TikTok CDN 403 résolu. TikTok joue via proxy natif (testé live, 175s, readyState 1). 366 tests verts. Prêt pour commit + PR.

---

## 1. Accomplished

### This session
- **Fix TikTok CDN 403** — cookie injection dans le proxy CDN fetch
- `src/services/cookies-parser.ts` — nouveau : parse Netscape cookies.txt, filtre par domaine (wildcard `.tiktok.com` → `v19-webapp.tiktok.com`), retourne `Cookie: ...` header
- `src/services/ytdlp.ts` — `-g` → `-J` (JSON output), retourne `{ url, headers }` au lieu de `string`, injecte les cookies CDN via `parseCookiesForDomain`
- `src/services/video-proxy-cache.ts` — cache porte `headers?: Record<string,string>` ; `resolveVideoProxy` retourne `{ url, headers? } | null`
- `src/components/api/videoProxyRoute.ts` — forward les headers stockés (Cookie, UA, Referer) vers le fetch CDN
- `src/services/content-utils.ts` — path TikTok adapté au nouveau type `{ url, headers }`
- `test-cobalt-server.mjs` — `parseCookiesForDomain` inlinée, Cookie header injecté pour les streams TikTok
- `src/__tests__/services/cookies-parser.test.ts` — 7 nouveaux tests (parse, wildcard domain, anti-spoofing, ENOENT, malformed lines)
- `src/__tests__/services/content-utils.cobalt.test.ts` — mocks `extractVideoUrl` mis à jour vers `{ url, headers }`
- **366 tests verts** (359 → +7), lint propre
- **Test live validé** : TikTok vidéo chargée (175s), readyState 1 via http://127.0.0.1:4502

### Previous sessions
- Audit sécurité phase 3, desktop-client v1.3.1, CVE patch x5, CI fix.
- Cobalt (Twitter) + yt-dlp (TikTok) architecture, proxy Range-aware, iframe fallback.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/services/cookies-parser.ts` | Parse Netscape cookies.txt → Cookie header string pour un domaine |
| `src/services/ytdlp.ts` | yt-dlp `-J` wrapper — retourne `{ url, headers }` + cookie injection |
| `src/services/video-proxy-cache.ts` | cache `{ url, headers?, exp }` — token → CDN entry avec headers |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream proxy Range-aware + forward headers |
| `src/services/content-utils.ts` | TikTok → extractVideoUrl → proxy ; Twitter → Cobalt → proxy |
| `cobalt-cookies/cookies.txt` | Cookies TikTok Netscape (gitignored) |

---

## 3. Remaining / Next Steps

1. **[NEXT]** Commit `feature/tiktok-twitter-integration` + PR → `main`
2. **H-AUD-06** — Socket.IO payload scope : filtrer `media` (Discord proxy URL) du payload `new-message`
3. **Fastify v5 upgrade**
4. **`displayMediaFull`** feature
5. Twitter test : Cobalt non lancé en local lors du test — fonctionnel selon session précédente, vérifier en env Docker

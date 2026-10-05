# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/tiktok-twitter-integration` — proxy vidéo serveur implémenté. Twitter fonctionne via proxy (confirmé navigateur). TikTok attend cookies Cobalt (compte jetable). 358 tests verts.

---

## 1. Accomplished

### This session
- Branche `feature/tiktok-twitter-integration` créée depuis `develop`
- Spec : `docs/SPEC-tiktok-twitter.md`
- Plan : `tasks/plan.md` + `tasks/todo.md`
- **T1** : `env.ts` — `COBALT_API_URL` + `COBALT_PUBLIC_URL` (zod optional, `z.preprocess` empty-string → undefined)
- **T2** : `content-utils.ts` — `isTikTokUrl()`, `isTwitterUrl()` (exportées), `resolveCobaltUrl()`, early-return TikTok/Twitter dans `getContentInformationsFromUrl`
- **T3** : `client.html` — `extractEmbedUrl()`, `generateIframe()` (null-safe), branche `video/tiktok`/`video/twitter` dans `displayContent`
- **T4** : `docker-compose.yml` — service `cobalt` (ghcr.io/imputnet/cobalt:10, port 9000)
- **T5** : `src/__tests__/services/content-utils.cobalt.test.ts` — 24 tests (URL detectors, Cobalt tunnel/redirect/error/timeout/short-links)
- **7 bugs corrigés** (code review) : preprocess empty→undefined, default Cobalt URL vide, tunnel URL interne → null, COBALT_TIMEOUT_MS=15s séparé, clearTimeout dual-path, generateIframe null-safe, isTikTok/new URL dedup
- **351 tests verts, lint propre**
- **Vérification runtime** (Chrome, port 4500) : 5/5 scénarios PASS
  - TikTok standard → iframe embed correct
  - TikTok short link (vm.tiktok.com) → null guard tenu, bloc vide
  - Twitter/X → iframe embed correct
  - twitter.com old domain → embed correct
  - Profil TikTok sans /video/ID → null guard tenu

### Previous sessions
- Audit sécurité phase 3 (H-AUD-01/02/03/04/07 + C-AUD-02), desktop-client v1.3.1, CVE patch x5, CI fix.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/services/content-utils.ts` | + isTikTokUrl, isTwitterUrl, resolveCobaltUrl → storeVideoProxy → proxy URL |
| `src/services/video-proxy-cache.ts` | Cache UUID→URL upstream (TTL 30 min) — nouveau |
| `src/components/api/videoProxyRoute.ts` | GET /api/video?t=TOKEN — stream-proxy Range-aware — nouveau |
| `src/loaders/RESTLoader.ts` | + VideoProxyRoute enregistrée sur /api |
| `src/services/env.ts` | + COBALT_API_URL / COBALT_PUBLIC_URL (preprocess empty→undefined) |
| `src/components/client/client.html` | + generateIframe (null-safe), extractEmbedUrl, branche video/tiktok+video/twitter |
| `docker-compose.yml` | + service cobalt (port 9000) |
| `src/__tests__/services/content-utils.cobalt.test.ts` | 31 tests Cobalt |

---

## 3. Next Steps

1. **Cookies TikTok** — compte jetable → export cookies Netscape → `cobalt-cookies/cookies.txt` → ajout volume Docker Cobalt + env var (voir section 4)
2. **Commit + PR** — `feature/tiktok-twitter-integration` → `develop`
3. **H-AUD-06** — Socket.IO payload scope : filtrer `media` (Discord proxy URL) du payload `new-message`
4. **Fastify v5 upgrade** — débloque CVE find-my-way + fast-uri restants
5. **`displayMediaFull`** — worker lit flag Guild → Socket.IO payload → client CSS

## 4. TikTok Cookies Setup

TikTok bloque le proxy Cobalt sans session cookies. Solution sans exposer de données personnelles :

1. Créer un compte TikTok jetable (mail temp type mail.tm ou guerrillamail)
2. Se connecter sur tiktok.com dans Chrome
3. Installer extension "Get cookies.txt LOCALLY"
4. Exporter les cookies de tiktok.com → fichier `cookies.txt` format Netscape
5. Placer dans `cobalt-cookies/cookies.txt` à la racine du repo (gitignored)
6. Ajouter au docker-compose cobalt service :
   ```yaml
   environment:
     COOKIE_FILE: /cookies/cookies.txt
   volumes:
     - ./cobalt-cookies:/cookies:ro
   ```
7. Redémarrer Cobalt : `docker compose restart cobalt`

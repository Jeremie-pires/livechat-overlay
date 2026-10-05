# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/tiktok-twitter-integration` — implémentation + review + corrections + vérification runtime terminées. Prêt à commit + PR.

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
| `src/services/content-utils.ts` | + isTikTokUrl, isTwitterUrl, resolveCobaltUrl (COBALT_TIMEOUT_MS=15s, clearTimeout, null-safe rewrite) |
| `src/services/env.ts` | + COBALT_API_URL / COBALT_PUBLIC_URL (preprocess empty→undefined) |
| `src/components/client/client.html` | + generateIframe (null-safe), extractEmbedUrl, branche video/tiktok+video/twitter |
| `docker-compose.yml` | + service cobalt (port 9000, API_URL=$COBALT_PUBLIC_URL) ; defaults vides pour les 2 vars |
| `.env.example` | + COBALT_API_URL / COBALT_PUBLIC_URL documentés |
| `src/__tests__/services/content-utils.cobalt.test.ts` | 24 tests Cobalt (nouveau fichier) |

---

## 3. Next Steps

1. **Commit + PR** — `feature/tiktok-twitter-integration` → `develop` (tout est prêt, 351 tests verts, runtime vérifié)
2. **H-AUD-06** — Socket.IO payload scope : filtrer `media` (Discord proxy URL) du payload `new-message`
3. **Fastify v5 upgrade** — débloque CVE find-my-way + fast-uri restants
4. **`displayMediaFull`** — worker lit flag Guild → Socket.IO payload → client CSS
5. **L-01** — tsconfig strict (bloqué par `ignoreDeprecations: "6.0"`)

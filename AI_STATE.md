# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — PR #74 (`develop → main`) — CI green, Sonar Quality Gate **Passed**. Dev tests in progress.

---

## 1. Accomplished

### Session 29 (Full 5-axis code review + mass fix)
- **CODE_REVIEW.md** : audit complet 39 fichiers, trouvé 5 Required + sécurité + consider
- **C-1** `hidetalkCommand.ts` : `deferReply({ ephemeral: true })` avant TTS — interaction Discord n'expire plus
- **C-2** `dashboardRoutes.ts` : validation `access_token` et `user.id` OAuth avant cast
- **S-2** `videoProxyRoute.ts` : `assertPublicHttpUrl()` sur l'URL CDN avant fetch (SSRF guard)
- **S-3** `cookies-parser.ts` : sanitisation des valeurs cookies (strip `\r\n;`)
- **A-1** `hashToken` : extrait dans `session.ts`, dédupliqué depuis `socketLoader.ts` et `dashboardRoutes.ts`
- **A-2** `gtts.ts` : fichiers TTS dans `os.tmpdir()` au lieu de `__dirname` (compatible Docker read-only)
- **A-2b** `gtts.ts` : cleanup fichier temp sur erreur de save
- **A-3** `module.d.ts` : `commandsLoaded: string[]` ajouté aux globals TypeScript ; `FastifyLoggerInstance` → `FastifyBaseLogger`
- **A-4** `RESTLoader.ts` : suppression import `lodash` pour startCase (inline)
- **A-5** `env.ts` : suppression `PREPRODUCTION` (jamais atteignable), `isPreProductionEnv()`, `isDeployedEnv()` (dead code)
- **A-6** `cpuSampler.ts` : `setInterval(...).unref()`
- **A-7** `presenceStore.ts`/`presenceSse.ts` : export + import du type `PublicPresenceEntry` partagé
- **A-9** `DiscordLoader.ts` : suppression commentaire `eslint-disable` résiduel
- **A-10** `commandHelpers.ts` : `TalkQueueConfig.text: string | undefined` (était `unknown`)
- **C-4** `video-proxy-cache.ts` : éviction périodique `setInterval(...).unref()`
- **C-6** `talkCommand.ts`/`hidetalkCommand.ts` : suppression check longueur mort (Discord gère via `setMaxLength`)

### Session 28 (TikTok silent failure + VidstackPlayer error handler)
- VidstackPlayer error handler ; CDN domain logging ; proxy warning enriched
- Root cause suspected : CDN domain `*.tiktokcdn-us.com` ≠ `.tiktok.com` cookies. Awaiting log confirmation.

### Session 27 (429 + 503 overlay fixes)
- Rate limit 100 → 300 req/min ; `/client/` exempted ; `bot:offline` + overlay hide/show

---

## 2. Current State

| Item | State |
|---|---|
| PR #74 | Quality Gate Passed — awaiting dev test sign-off |
| Prod containers | `livechatccb` (port 3000) + `cobalt` (port 9000) |
| Dev containers | Need `git pull && docker compose up --build -d` |
| TikTok CDN | VidstackPlayer error handler added — root cause unconfirmed, needs log |
| Code quality | 17 fichiers corrigés suite audit — lint + tsc source propres |

---

## 3. Next Steps

### [IMMEDIATE]
1. VPS: `git pull && docker compose up --build -d`
2. Send a TikTok command → check logs for `cdnDomain` to confirm cookie mismatch root cause
3. If `cdnDomain` = `*.tiktokcdn.com` / `*.tiktokcdn-us.com` → fix `parseCookiesForDomain` matching

### [AFTER TESTS PASS]
- Merge PR #74 (`develop → main`)

### [LATER]
- H-AUD-06: 4 commands store `media` in DB instead of `audio` (type field mismatch)
- S-1 CSP nonce : remplacer `unsafe-inline` dans le dashboard (post-merge, requiert modif HTML)

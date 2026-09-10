# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — audit sécurité phase 3 terminé (commit `45d10f0`).

---

## 1. Accomplished

### This session
- **Audit phase 3 — 6 points corrigés** (commit `45d10f0`) :
  - **H-AUD-01** : CSP header sur le dashboard (hook `onSend` scopé au plugin), redirect OAuth remplacé par HTTP 302 (suppression du inline script)
  - **H-AUD-02** : `pnpm prune --prod` dans Dockerfile builder → runtime sans devDeps
  - **H-AUD-03** : suppression `Object.assign(process.env, env)` dans `index.ts`
  - **H-AUD-04** : `trustProxy` conditionnel `isDeployedMode() ? 1 : false`
  - **H-AUD-05** : confirmé déjà corrigé (transaction atomique Prisma dans messagesWorker)
  - **H-AUD-07** : pino redact paths `**` (récursif) + `req.query.code` / `access_token` / `client_secret`
  - **C-AUD-02** : ffprobe spawné directement avec timeout 5s SIGKILL + URL IP-pinnée conservée ; mock test mis à jour (`child_process` au lieu de `get-video-duration`)

### Previous sessions
- Electron startup hardening, Fix CORS 404, Fix Prisma null guildId, CVE patch x5, CI desktop-release fix, desktop-client bumped 1.3.0 → 1.3.1.
- SonarQube Quality Gate fixes (v1.3.0), rate-limit socket.io, chemins SVG absolus, nav dot rouge disconnect, toast bot online, slider taille overlay, bot status/maintenance push chaîne complète, dashboard refacto, centralized Discord error handler, release stable v1.2.11.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/server.ts` | trustProxy conditionnel, redact `**`, CORS, rate-limit |
| `src/index.ts` | Plus de Object.assign(process.env, env) |
| `src/services/content-utils.ts` | ffprobe custom spawn (5s timeout, IP-pinned URL) |
| `src/components/dashboard/dashboardRoutes.ts` | CSP header scopé + redirect HTTP 302 OAuth |
| `src/loaders/DiscordLoader.ts` | Guard guildId null avant findFirst |
| `src/loaders/socketLoader.ts` | Émet `server:status` à chaque connect Socket.IO |
| `desktop-client/src/main.ts` | Startup hardening, applyLoginItemSettings guard isPackaged |
| `desktop-client/src/renderer/renderer.js` | serverState, computeNavDotStatus, showStatusToast, rAF slider |
| `desktop-client/package.json` | Version: `1.3.1` |
| `.github/workflows/desktop-release.yml` | electron-builder crée release → gh release edit notes |
| `Dockerfile` | pnpm prune --prod en fin de stage builder |
| `package.json` + `pnpm-lock.yaml` | overrides CVE : brace-expansion, fast-uri, nanoid, socket.io-parser, tar |
| `.trivyignore` | ip-address CVE-2026-69192 (fix = major bump v10, bloqué) |

---

## 3. Next Steps

1. **Valider v1.3.1** — confirmer exe build OK + auto-update utilisateurs
2. **H-AUD-06** — Socket.IO payload scope : vérifier si `media` (Discord proxy URL) doit être filtré du payload `new-message` (à confirmer côté client)
3. **Fastify v5 upgrade** — débloque CVE find-my-way + fast-uri restants
4. **`displayMediaFull`** — worker lit flag Guild → Socket.IO payload → client CSS
5. **L-01** — tsconfig strict (bloqué par `ignoreDeprecations: "6.0"`)
6. **Nouvelles idées user** — à définir

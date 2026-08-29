# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — v1.3.0 stable released. v1.3.1 en préparation (tests local en cours).

---

## 1. Accomplished

### This session
- **Fix Prisma null guildId** (`src/loaders/DiscordLoader.ts:199`) : garde `if (!interaction.guildId)` avant `findFirst()` — crash bot sur slash command en DM éliminé.
- **Fix CORS 404 fantômes** (`src/server.ts:28`) : `callback(new Error(), false)` → `callback(null, false)` + warn log `origin`/`allowedOrigin`. Corrige les double-404 dans les logs VPS au chargement du dashboard.
- **Electron startup hardening** (`desktop-client/src/main.ts`) :
  - `process.on('uncaughtException')` → `dialog.showErrorBox()` au lieu de crash silencieux.
  - Single-instance lock : `app.quit()` brut → dialog "L'app est déjà en cours d'exécution, vérifiez le tray".
  - `createTray()` : try/catch sur `nativeImage.createFromPath()` — fallback `controlWindow?.show()` si icon.ico manquant.
  - `bootstrap()` : `void bootstrap()` → `bootstrap().catch(err => dialog.showErrorBox(...))`.
  - `applyLoginItemSettings()` : guard `!app.isPackaged` → force `openAtLogin: false` en dev pour désenregistrer le binaire Electron de dev du startup Windows.
- **Commit** `2e381b8` pushé sur `develop`.

### Previous sessions
- SonarQube Quality Gate fixes (v1.3.0), rate-limit socket.io, chemins SVG absolus, nav dot rouge disconnect, toast bot online, slider taille overlay, bot status/maintenance push chaîne complète, dashboard refacto, centralized Discord error handler, release stable v1.2.11.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/loaders/DiscordLoader.ts` | Guard guildId null avant findFirst |
| `src/server.ts` | CORS callback null + warn log, skip socket.io rate-limit |
| `src/loaders/socketLoader.ts` | Émet `server:status` à chaque connect Socket.IO |
| `src/components/dashboard/dashboardRoutes.ts` | Toggle maintenance → `fastify.io.emit('server:maintenance')` |
| `src/components/client/client.html` | Relay server:status/maintenance → IPC |
| `desktop-client/src/main.ts` | Startup hardening, applyLoginItemSettings guard isPackaged, IPC handlers |
| `desktop-client/src/renderer/renderer.js` | serverState, computeNavDotStatus, showStatusToast, rAF slider |
| `desktop-client/package.json` | Version: `1.3.0` |

---

## 3. Next Steps

1. **Release v1.3.1** — tester local → définir release notes → `git tag -a v1.3.1 -m "..."` + push tag
2. **Audit phase 3** :
   - 🔴 C-AUD-02 ffprobe DNS rebinding
   - 🟠 H-AUD-01 CSP, H-AUD-02 Docker dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev
3. **Fastify v5 upgrade** — débloque CVE find-my-way + fast-uri
4. **`displayMediaFull`** — worker lit flag Guild, injecte dans Socket.IO payload, client applique CSS
5. **L-01** — tsconfig strict (bloqué par `ignoreDeprecations: "6.0"`)

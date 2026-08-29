# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — v1.3.1 build CI en cours (tag pushé sur commit `bbd5675`).

---

## 1. Accomplished

### This session
- **Electron startup hardening** (`desktop-client/src/main.ts`) : uncaughtException dialog, single-instance dialog, tray try/catch, bootstrap catch, applyLoginItemSettings guard `!app.isPackaged`.
- **Fix CORS 404 fantômes** (`src/server.ts`) : `callback(new Error(), false)` → `callback(null, false)` + warn log.
- **Fix Prisma null guildId** (`src/loaders/DiscordLoader.ts:199`) : guard `if (!interaction.guildId)`.
- **CVE patch x5** (`package.json`, `pnpm-lock.yaml`, `.trivyignore`) : brace-expansion 2.1.4, fast-uri 2.4.5, nanoid 3.3.18, socket.io-parser 4.2.7, tar 7.5.22. ip-address CVE-2026-69192 → trivyignore.
- **404 log niveau** (`src/server.ts`) : `setNotFoundHandler` → warn (supprime bruit dashboard).
- **CI desktop-release fix** (`.github/workflows/desktop-release.yml`) : suppression du `gh release create` qui créait des releases orphelines. Electron-builder crée la release lui-même, `gh release edit` pose les notes après. Draft orphelin `v1.3.1-rc.1`/`tagName:v1.3.1` supprimé.
- **desktop-client version** : bumped `1.3.0` → `1.3.1`.

### Previous sessions
- SonarQube Quality Gate fixes (v1.3.0), rate-limit socket.io, chemins SVG absolus, nav dot rouge disconnect, toast bot online, slider taille overlay, bot status/maintenance push chaîne complète, dashboard refacto, centralized Discord error handler, release stable v1.2.11.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/server.ts` | CORS callback null, setNotFoundHandler warn, skip socket.io rate-limit |
| `src/loaders/DiscordLoader.ts` | Guard guildId null avant findFirst |
| `src/loaders/socketLoader.ts` | Émet `server:status` à chaque connect Socket.IO |
| `src/components/dashboard/dashboardRoutes.ts` | Toggle maintenance → `fastify.io.emit('server:maintenance')` |
| `desktop-client/src/main.ts` | Startup hardening, applyLoginItemSettings guard isPackaged |
| `desktop-client/src/renderer/renderer.js` | serverState, computeNavDotStatus, showStatusToast, rAF slider |
| `desktop-client/package.json` | Version: `1.3.1` |
| `.github/workflows/desktop-release.yml` | electron-builder crée release → gh release edit notes |
| `package.json` + `pnpm-lock.yaml` | overrides CVE : brace-expansion, fast-uri, nanoid, socket.io-parser, tar |
| `.trivyignore` | ip-address CVE-2026-69192 supprimé (fix = major bump v10, bloqué) |

---

## 3. Next Steps

1. **Valider v1.3.1** — confirmer exe build OK + auto-update utilisateurs
2. **Audit phase 3** :
   - 🔴 C-AUD-02 ffprobe DNS rebinding
   - 🟠 H-AUD-01 CSP, H-AUD-02 Docker dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev
3. **Fastify v5 upgrade** — débloque CVE find-my-way + fast-uri restants
4. **`displayMediaFull`** — worker lit flag Guild → Socket.IO payload → client CSS
5. **L-01** — tsconfig strict (bloqué par `ignoreDeprecations: "6.0"`)
6. **Nouvelles idées user** — à définir

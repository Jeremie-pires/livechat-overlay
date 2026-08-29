# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — v1.3.1 en cours de release (tag pushé, build CI en attente).

---

## 1. Accomplished

### This session
- **Fix Prisma null guildId** (`src/loaders/DiscordLoader.ts:199`) : guard `if (!interaction.guildId)` avant `findFirst()`.
- **Fix CORS 404 fantômes** (`src/server.ts:28`) : `callback(new Error(), false)` → `callback(null, false)` + warn log.
- **Electron startup hardening** (`desktop-client/src/main.ts`) : uncaughtException dialog, single-instance dialog, tray try/catch, bootstrap catch, applyLoginItemSettings guard isPackaged.
- **CVE patch x5** (`package.json`, `pnpm-lock.yaml`, `.trivyignore`) : brace-expansion 2.1.4, fast-uri 2.4.5, nanoid 3.3.18, socket.io-parser 4.2.7, tar 7.5.22. ip-address CVE-2026-69192 supprimé trivyignore.
- **404 log niveau** (`src/server.ts`) : `setNotFoundHandler` → warn au lieu de error (bruit dashboard).
- **CI fix** (`.github/workflows/desktop-release.yml`) : `gh release create` → check existence + fallback `gh release edit`.
- **Release v1.3.1** : tag `v1.3.1 -m "fix de bugs"` pushé sur develop.

### Previous sessions
- SonarQube Quality Gate fixes (v1.3.0), rate-limit socket.io, chemins SVG absolus, nav dot rouge disconnect, toast bot online, slider taille overlay, bot status/maintenance push chaîne complète, dashboard refacto, centralized Discord error handler, release stable v1.2.11.

---

## 2. Current Architecture (key files)

| File | Rôle |
|---|---|
| `src/loaders/DiscordLoader.ts` | Guard guildId null avant findFirst |
| `src/server.ts` | CORS callback null + warn log, setNotFoundHandler warn |
| `src/loaders/socketLoader.ts` | Émet `server:status` à chaque connect Socket.IO |
| `src/components/dashboard/dashboardRoutes.ts` | Toggle maintenance → `fastify.io.emit('server:maintenance')` |
| `src/components/client/client.html` | Relay server:status/maintenance → IPC |
| `desktop-client/src/main.ts` | Startup hardening, applyLoginItemSettings guard isPackaged, IPC handlers |
| `desktop-client/src/renderer/renderer.js` | serverState, computeNavDotStatus, showStatusToast, rAF slider |
| `desktop-client/package.json` | Version: `1.3.1` |
| `.github/workflows/desktop-release.yml` | CI desktop — gh release create/edit fallback |

---

## 3. Next Steps

1. **Valider release v1.3.1** — confirmer exe build OK sur GitHub
2. **Audit phase 3** :
   - 🔴 C-AUD-02 ffprobe DNS rebinding
   - 🟠 H-AUD-01 CSP, H-AUD-02 Docker dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev
3. **Fastify v5 upgrade** — débloque CVE find-my-way + fast-uri
4. **`displayMediaFull`** — worker lit flag Guild, injecte dans Socket.IO payload, client applique CSS
5. **L-01** — tsconfig strict (bloqué par `ignoreDeprecations: "6.0"`)
6. **Nouvelles idées user** — à définir

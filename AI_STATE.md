# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — active development. v1.3.0 stable released. v1.3.1 en préparation.

---

## 1. Accomplished

### This session
- **Electron startup hardening** (`desktop-client/src/main.ts`) — v1.3.1 :
  - `process.on('uncaughtException')` → `dialog.showErrorBox()` au lieu de crash silencieux.
  - Single-instance lock : `app.quit()` brut → dialog "L'app est déjà en cours d'exécution, vérifiez le tray".
  - `createTray()` : try/catch sur `nativeImage.createFromPath()` — fallback `controlWindow?.show()` si icon.ico manquant.
  - `bootstrap()` : `void bootstrap()` → `bootstrap().catch(err => dialog.showErrorBox(...))`.
- **Fix CORS server** (`src/server.ts`) : `callback(new Error(), false)` → `callback(null, false)` + warn log avec origin rejetée. Évite les 404 fantômes dans unify-fastify sur le VPS.
- **Fix Prisma null guildId** (`src/loaders/DiscordLoader.ts`) : garde `if (!interaction.guildId)` avant `findFirst()` — commande slash en DM ne crash plus le bot.

### Previous session
- **SonarQube Quality Gate fixes** (4 fichiers) :
  - `main.ts:app:open-external` — Security C (bloquant) : URL user-controlled → parse `new URL()` + validate `parsed.protocol` + utiliser `parsed.href` (pattern reconnu par SonarQube).
  - `renderer.js:reconcileUserList` — Reliability C (bloquant) : `getAttribute('data-user-id')` → `dataset.userId`.
  - `renderer.js:loadChangelog` — Code smell : `.replace(/</g,...)` × 2 → `.replaceAll('<',...)`.
  - `renderer.js:showTestResult` — Code smell : ternaire imbriqué → `const icons = {…}; icons[type] ?? '⏳'`.
  - `index.html` (5 inputs) — Accessibility : `<p class="field-label">` → `<label class="field-label" for="inputId">` (backendUrl, guildId, clientToken, localServerPort, obsUrlDisplay).
  - `index.html:maintenanceBanner` — Accessibility : `<div role="status">` → `<output>` (élément sémantique natif).
  - `styles.css:.maintenance-banner` — Contrast WCAG : `color:#f59e0b` sur fond `rgba(245,158,11,0.1)` (ratio ~1.5:1) → `background:rgba(120,53,15,0.88)` + `color:#fcd34d` (ratio >4.5:1 même sur fond blanc).
  - `styles.css:.field-label` + `.obs-url-label` — `display:block` ajouté pour préserver le layout après passage `<p>`→`<label>`.
- **Fix rate-limit socket.io** (`server.ts`) : `FastifyRateLimit` s'appliquait aussi aux requêtes `/socket.io/*` (polling, WS upgrade). Le proxy OBS local fait ~15+ reconnexions/min × 3 req HTTP = >45 req/min depuis la même IP, plus l'overlay. Total >100/min → 429 sur les requêtes SVG de test format. Fix : `skip: (req) => req.url.startsWith('/socket.io')`.
- **Fix chemins SVG test formats** (`client.html`) : `./img/*.svg` → `/client/img/*.svg` (chemins absolus). Le proxy OBS local (`local-server.ts`) filtre les requêtes sur `/client/*` ; avec un chemin relatif depuis `http://localhost:3001/client?...`, la résolution donnait `/img/*.svg` qui ne passait pas le filtre (→ 404 silencieux). Portrait "semblait fonctionner" mais c'était le même problème.
- **Nav dot rouge sur disconnect** (`client.html`) : `lastKnownMaintenance` tracké dans les handlers `server:status` et `server:maintenance`. Handler `socket.on('disconnect')` ajouté — émet `reportServerStatus({ botOnline: false, maintenance: lastKnownMaintenance })` via IPC. Résultat : la dot passe rouge dès que le backend coupe, même si le HTML de l'overlay reste chargé.
- **Toast générique + notif bot online** (`renderer.js`) : `showMaintenanceToast(maintenance)` → `showStatusToast(type, title, body)` (générique). Flag `serverStatusInitialized` pour ne déclencher le toast qu'après la première connexion initiale (évite un toast parasite au démarrage). `onServerStatus` : détecte la transition `botOnline false→true` hors maintenance → toast succès "Bot Discord en ligne". `onMaintenance` : utilise `showStatusToast` avec les deux cas (warning/success).

### Previous session
- **Slider taille dynamique** (`main.ts`, `preload.ts`, `renderer.js`) : deux IPC séparés — `overlay:set-size` (sauvegarde disque, persistance) et `overlay:preview-size` (exécute `__updateLayoutSettings` sur l'overlay sans I/O disque). Renderer utilise `requestAnimationFrame` throttle sur `input` → preview live ~60fps. Sauvegarde disque seulement au `change` (relâché).
- **Nav status dot** (`index.html`, `styles.css`, `renderer.js`) : point coloré en bas à droite du logo sidebar. États : gris (idle), orange (loading/maintenance avec `dot-pulse`), vert (connected), rouge (error). Wrapper `.sidebar-logo-wrap { position: relative }` + `.nav-status-dot` absolu.
- **Bot status + maintenance push — chaîne complète** (10 fichiers) :
  - `socketLoader.ts` : émet `server:status { botOnline, maintenance }` à chaque nouveau client Socket.IO connecté (query Prisma `Stats.silentMode` + `discordClient.isReady()`).
  - `dashboardRoutes.ts` : après `POST /api/maintenance/toggle`, émet `server:maintenance { maintenance }` à tous les clients via `fastify.io.emit()`.
  - `client.html` : écoute `server:status` et `server:maintenance`, relay via `window.livechatOverlay.reportServerStatus/reportMaintenance`.
  - `overlay-preload.ts` : expose `reportServerStatus` et `reportMaintenance` via contextBridge → `ipcRenderer.send`.
  - `main.ts` : deux `ipcMain.on` (`server:status`, `server:maintenance`) avec validation de type → `controlWindow.webContents.send`.
  - `preload.ts` : `onServerStatus` et `onMaintenance` exposés via contextBridge (avec types TypeScript).
  - `renderer.js` : `serverState { botOnline, maintenance }` initialisé depuis `localStorage`. `computeNavDotStatus()` prioritise maintenance > loading > connected/error > idle. `applyServerState()` met à jour le dot + la bannière + persiste `localStorage`. `showMaintenanceToast()` affiche le toast 5s avec dismiss manuel.
  - `index.html` : `#maintenanceBanner` (fixed bottom, left:60px) + `#maintenanceToast` (fixed top-right).
  - `styles.css` : `.maintenance-banner`, `.maintenance-toast`, `@keyframes dot-pulse`, `@keyframes toast-slide-in`, `.btn-ghost`.
- **Edge case Docker restart** : si `serverState.maintenance = true` lors d'une perte de connexion, `computeNavDotStatus()` retourne `'maintenance'` au lieu de `'error'`. `localStorage` persiste l'état même si l'app Electron est redémarrée pendant la maintenance. Au reconnect, `server:status` confirme l'état depuis la DB.
- **Update modal audit** (`index.html`, `styles.css`) : `border: 2px → 1px` sur la card (cohérence UI), bouton "Plus tard" `btn-outline-blue → btn-ghost` (hiérarchie action secondaire), `cursor: pointer` ajouté sur `btn-outline-blue`.

### Previous session
- **Desktop UI refonte haute fidélité** (`index.html`, `styles.css`, `renderer.js`) : sidebar verticale 60px + 4 panels (status/home, settings overlay, server config, users). Logo app + titre, nav icons SVG custom, position grid 3×3 `aspect-ratio: 4/2`, overlay button rouge (actif) vs jaune (inactif), changelog GitHub releases lazy, smart default tab (premier lancement → home, retour → settings), présence badge `margin-left: auto`, dot online `#4ee08a`.

### Previous sessions
- **Dashboard refacto** (`src/components/dashboard/`): monolithe 1133 lignes → 4 fichiers propres. SonarQube Quality Gate fixes.
- **Centralized Discord error handler** (`src/services/discordErrorHandler.ts`): `classifyAndReply()`.
- **Log timezone fix** (`src/server.ts`): `toLocalISOString()` → timestamps `+02:00`/`+01:00` TZ=Europe/Paris.
- **Stable release v1.2.11**: bumped, tagged, pushed — CI stable GitHub Release.

### Previous sprints (merged)
- Port OBS field UI + validation, text wrapping, Trivy CVE fixes, full DevSecOps audit (29 findings), SSRF guard, CSRF tokens, atomic queue dequeue, TTS cleanup, HTTP security headers, DOM XSS hardening, Docker resource limits, session TTL eviction, health route hardening, local OBS server in Electron (port 3001).

---

## 2. Current Architecture (key files)

| File | Role |
|---|---|
| `src/loaders/socketLoader.ts` | Émet `server:status { botOnline, maintenance }` à chaque connect Socket.IO |
| `src/components/dashboard/dashboardRoutes.ts` | Toggle maintenance → `fastify.io.emit('server:maintenance')` push temps réel |
| `src/components/client/client.html` | Relay `server:status` + `server:maintenance` → IPC via `livechatOverlay` |
| `src/components/dashboard/dashboardRoutes.ts` | Route handlers OAuth + dashboard + SSE (191 lignes) |
| `src/services/discordErrorHandler.ts` | Centralized Discord error classifier + ephemeral reply |
| `src/server.ts` | Fastify init, `toLocalISOString()` Paris-timezone logs, security headers |
| `src/components/client/client.html` | OBS browser source — vidstack player, Socket.IO |
| `desktop-client/src/local-server.ts` | Local HTTP+Socket.IO server for OBS (port 3001) |
| `desktop-client/src/main.ts` | BrowserWindow 480×720, IPC handlers + `overlay:preview-size` (no disk) + `overlay:set-size` (disk) + forward `server:status`/`server:maintenance` |
| `desktop-client/src/overlay-preload.ts` | Expose presence + `reportServerStatus` + `reportMaintenance` via contextBridge |
| `desktop-client/src/preload.ts` | Expose `onServerStatus`, `onMaintenance`, `setSize`, `previewSize` + tous les IPC existants |
| `desktop-client/src/renderer/index.html` | Sidebar + 4 panels + `#maintenanceBanner` (fixed bottom) + `#maintenanceToast` (fixed top-right) + update modal |
| `desktop-client/src/renderer/styles.css` | Palette dark, sidebar, panels, `dot-pulse` animation, `.maintenance-banner`, `.maintenance-toast`, `.btn-ghost` |
| `desktop-client/src/renderer/renderer.js` | `serverState` + `computeNavDotStatus()` + `applyServerState()` + `showStatusToast(type,title,body)` + rAF throttle size slider |
| `desktop-client/package.json` | Version: `1.3.0` (stable) |

---

## 3. Next Steps

1. **Release desktop v1.3.0** — ✅ tag poussé, CI en cours
2. **Audit phase 3**:
   - CRITICAL: C-AUD-02 ffprobe DNS rebinding
   - HIGH: H-AUD-01 CSP, H-AUD-02 Docker runner dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP restriction, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev mode
3. **Fastify v5 upgrade** — unblocks find-my-way CVE-2026-47219 et fast-uri CVEs
4. **`displayMediaFull`** — worker lit flag Guild, l'injecte dans Socket.IO payload, client applique CSS
5. **L-01** — tsconfig strict flags (blocked by `ignoreDeprecations: "6.0"`)

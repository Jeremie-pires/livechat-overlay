# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — active development. v1.2.11 stable released.

---

## 1. Accomplished

### This session
- **Desktop UI refonte haute fidélité SVG** (`index.html` + `styles.css` réécrits intégralement) : analyse de CroustyBox_UI.ai.svg + 4 panels SVG → specs extraites. Principaux changements : (1) contenu area bg `#0e0e0e`, chaque panel enveloppé dans `.panel-card` (`#141414`, bordure `#262626` 3px, radius 30px) — la carte principale manquait totalement ; (2) headers pill colorés par panel (`card-header-blue` `#5a8dff` pour settings, `card-header-yellow` `#fcde63` pour server/users) ; (3) `.divider` 3px `#262626` entre sections ; (4) sidebar icons dans containers `.nav-icon` 38×38px radius 11px (inactive=`#141414`+border bleu, active=bleu plein blanc) ; (5) CTA/secondary buttons radius 34px (était 10px) ; (6) version pill vertical en sidebar footer.

### Previous session
- **Dashboard refacto** (`src/components/dashboard/`): monolithe 1133 lignes → 4 fichiers propres. `dashboardRoutes.ts` passe à 191 lignes (route handlers uniquement). HTML/CSS/JS extraits en fichiers dédiés chargés via `readFileSync` au démarrage. Deux nouvelles routes statiques `/dashboard.css` et `/dashboard.js`. Comportement identique.
- **SonarQube Quality Gate** — tous les failures corrigés : `var`→`let`, `getAttribute`→`.dataset`, complexité cognitive `refresh()` 19→6 (extraction `fmtLatStat`/`cpuBarClass`/`ramBarClass`/`buildGuildRow`/`buildBroadcastCell`). Warnings : `replaceAll`, optional chaining, `<a>`→`<button>`, `role="button"` + `onKeyDown`, `node:fs`/`node:path`.

### Previous sessions
- **Centralized Discord error handler** (`src/services/discordErrorHandler.ts`): `classifyAndReply()` — known Discord API errors (50001, 50013, 10003, 10008) → specific actionable i18n messages; system/unknown → generic message, no internal leak; code 10062 (expired interaction) → silent swallow.
- **Global handler simplified** (`DiscordLoader.ts`): 26-line duplicated embed block → `classifyAndReply(error, interaction)`.
- **Local Prisma catches removed** from `talkCommand.ts`, `sendCommand.ts`, `hidesendCommand.ts`, `hidetalkCommand.ts` — errors bubble to global handler.
- **i18n extended** (en + fr): `errorMissingAccess`, `errorMissingPermissions`, `errorUnknownChannel`, `errorUnknownMessage`.
- **Test fixed** (`commandHandlers.test.ts` I-04): updated to simulate DiscordLoader flow — handler throws → `classifyAndReply` handles it.
- **Log timezone fix** (`src/server.ts`): `toISOString()` (always UTC) replaced by `toLocalISOString()` using `getHours()`/`getTimezoneOffset()` → timestamps now `+02:00`/`+01:00` respecting `TZ=Europe/Paris` in docker-compose, DST-aware.

### Previous sessions
- **Stable release v1.2.11**: bumped, tagged, pushed — CI stable GitHub Release, auto-update triggers for all users.
- **Pre-release v1.2.11-rc.1**: tagged, pushed — CI pre-release, no auto-update for stable users.

### Previous sprints (merged)
- Port OBS field UI + validation, text wrapping, Trivy CVE fixes, full DevSecOps audit (29 findings), SSRF guard, CSRF tokens, atomic queue dequeue, TTS cleanup, HTTP security headers, DOM XSS hardening, Docker resource limits, session TTL eviction, health route hardening, local OBS server in Electron (port 3001).

---

## 2. Current Architecture (key files)

| File | Role |
|---|---|
| `src/components/dashboard/dashboardRoutes.ts` | Route handlers OAuth + dashboard + SSE (191 lignes) |
| `src/components/dashboard/dashboard.html` | Template HTML du dashboard (placeholder `{{CSRF_TOKEN}}`) |
| `src/components/dashboard/dashboard.css` | Styles glassmorphism du dashboard |
| `src/components/dashboard/dashboard.js` | JS client-side dashboard (SPA routing, polling, SSE) |
| `src/services/discordErrorHandler.ts` | Centralized Discord error classifier + ephemeral reply |
| `src/loaders/DiscordLoader.ts` | Global interaction handler — delegates errors to `classifyAndReply` |
| `src/server.ts` | Fastify init, `toLocalISOString()` for Paris-timezone logs, security headers |
| `src/services/i18n/en.ts` / `fr.ts` | i18n — includes 4 new error keys |
| `src/components/client/client.html` | OBS browser source — vidstack player, Socket.IO |
| `desktop-client/src/local-server.ts` | Local HTTP+Socket.IO server for OBS (port 3001) |
| `src/services/session.ts` | Session + CSRF maps, hourly eviction |
| `desktop-client/src/main.ts` | BrowserWindow 480×720, IPC `app:open-external` avec guard https/http |
| `desktop-client/src/preload.ts` | Expose `openExternal(url)` via contextBridge |
| `desktop-client/src/renderer/index.html` | Layout sidebar + 4 tab-panels (status/settings/server/users) |
| `desktop-client/src/renderer/styles.css` | Palette flat dark, composants sidebar, changelog, modal |
| `desktop-client/src/renderer/renderer.js` | Nav sidebar, `loadChangelog()`, Discord button, switchTab renommés |
| `desktop-client/package.json` | Version: `1.2.11` (stable) |
| `.trivyignore` | CVE suppressions: find-my-way v9 / brace-expansion v5 |

---

## 3. Next Steps

1. **Audit phase 3**:
   - CRITICAL: C-AUD-01 rate limiting (`@fastify/rate-limit` present, not wired), C-AUD-02 ffprobe DNS rebinding
   - HIGH: H-AUD-01 CSP, H-AUD-02 Docker runner dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP restriction, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev mode
2. **Fastify v5 upgrade** — unblocks find-my-way CVE-2026-47219 and fast-uri CVEs
3. **`displayMediaFull`** — worker reads Guild row, injects flag into Socket.IO payload, client applies CSS
4. **L-01** — tsconfig strict flags (blocked by `ignoreDeprecations: "6.0"`)
5. **Desktop UI** — refonte terminée. À faire : renseigner l'URL Discord invite dans `index.html` (`data-href` du bouton `#discordSupportBtn`), tester `pnpm dev` dans `desktop-client/`
6. **Release desktop v1.2.12** — bumper version + tag annoté une fois les tests OK

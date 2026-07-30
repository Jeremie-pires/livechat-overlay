# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — active development. Security overrides updated, UI fixes applied.

---

## 1. Accomplished

### This session
- **Port OBS field UI** (`desktop-client/src/renderer/styles.css`): `input[type="number"]` added to styled selector (same border, bg, padding, focus ring as text/password fields). Spinner opacity set to 0.4. Focus ring added.
- **Port validation** (`desktop-client/src/renderer/renderer.js`): `readFormValues` clamps `localServerPort` between 1024–65535.
- **"Livechat prêt" supprimé** (`src/components/client/client.html`): text removed from `<div id="empty-state">` — element stays in DOM (JS reference), content no longer visible after OBS button click.
- **Text wrapping** (`src/components/client/client.html`): `#message-text` `max-width` changed from `100%` to `var(--overlay-size, 960px)` + `overflow-wrap: break-word` — text now wraps at media frame width, prevents layout expansion.
- **Trivy CVE fixes** (`package.json`, `.trivyignore`, `pnpm-lock.yaml`):
  - `js-yaml` override: `>=4.3.0` → `>=5.2.2` (GHSA-pm4m-ph32-ghv5) — installed 5.2.2 ✅
  - `postcss` override added: `>=8.5.18` (GHSA-r28c-9q8g-f849) — installed 8.5.25 ✅
  - `find-my-way` CVE-2026-47219 → `.trivyignore` (fix = Fastify v5, major breaking change)
  - `brace-expansion` CVE-2026-14257 → `.trivyignore` (no 2.x patch, v5 breaks minimatch)

### Previous sprints (merged)
- Full DevSecOps audit (29 findings), SSRF guard, CSRF tokens, atomic queue dequeue, TTS cleanup, HTTP security headers, DOM XSS hardening, Docker resource limits, session TTL eviction, health route hardening, local OBS server in Electron (port 3001).

---

## 2. Current Architecture (key files)

| File | Role |
|---|---|
| `src/components/client/client.html` | OBS browser source — vidstack player, text/media display, Socket.IO |
| `desktop-client/src/renderer/styles.css` | Desktop app UI — `input[type="number"]` now styled consistently |
| `desktop-client/src/renderer/renderer.js` | Desktop renderer — port clamped 1024–65535 |
| `desktop-client/src/local-server.ts` | Local HTTP+Socket.IO server for OBS (port 3001) |
| `src/services/session.ts` | Session + CSRF maps, hourly eviction |
| `src/server.ts` | Security headers via `onSend` hook |
| `package.json` | pnpm overrides: js-yaml >=5.2.2, postcss >=8.5.18 (+ existing) |
| `.trivyignore` | CVE suppressions: find-my-way v9 / brace-expansion v5 incompatible |

---

## 3. Next Steps

1. **Audit phase 3** (from `.pipeline/full_security_audit.md`):
   - CRITICAL: C-AUD-01 rate limiting (`@fastify/rate-limit` — dep already present, not wired), C-AUD-02 ffprobe DNS rebinding
   - HIGH: H-AUD-01 CSP, H-AUD-02 Docker runner dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP restriction, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev mode
2. **Fastify v5 upgrade** — unblocks find-my-way CVE-2026-47219 and previous fast-uri CVEs
3. **`displayMediaFull`** — worker reads Guild row, injects flag into Socket.IO payload, client applies CSS
4. **L-01** — tsconfig strict flags (blocked by `ignoreDeprecations: "6.0"`)

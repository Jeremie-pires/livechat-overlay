# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — active development. v1.2.11 stable released.

---

## 1. Accomplished

### This session
- **Pre-release v1.2.11-rc.1**: `desktop-client/package.json` bumped to `1.2.11-rc.1`, tagged `v1.2.11-rc.1`, pushed — CI built pre-release (no auto-update for stable users).
- **Stable release v1.2.11**: `desktop-client/package.json` bumped to `1.2.11`, tagged `v1.2.11` with FR release notes, pushed — CI builds stable GitHub Release, auto-update triggers for all users.

### Previous sprints (merged)
- **Port OBS field UI** + port validation (1024–65535 clamp).
- **Text wrapping** (`#message-text` → `max-width: var(--overlay-size, 960px)` + `overflow-wrap: break-word`).
- **Trivy CVE fixes**: `js-yaml` >=5.2.2, `postcss` >=8.5.18, `.trivyignore` for find-my-way + brace-expansion.
- Full DevSecOps audit (29 findings), SSRF guard, CSRF tokens, atomic queue dequeue, TTS cleanup, HTTP security headers, DOM XSS hardening, Docker resource limits, session TTL eviction, health route hardening, local OBS server in Electron (port 3001).

---

## 2. Current Architecture (key files)

| File | Role |
|---|---|
| `src/components/client/client.html` | OBS browser source — vidstack player, text/media display, Socket.IO |
| `desktop-client/src/renderer/styles.css` | Desktop app UI — `input[type="number"]` styled consistently |
| `desktop-client/src/renderer/renderer.js` | Desktop renderer — port clamped 1024–65535 |
| `desktop-client/src/local-server.ts` | Local HTTP+Socket.IO server for OBS (port 3001) |
| `src/services/session.ts` | Session + CSRF maps, hourly eviction |
| `src/server.ts` | Security headers via `onSend` hook |
| `package.json` | pnpm overrides: js-yaml >=5.2.2, postcss >=8.5.18 |
| `.trivyignore` | CVE suppressions: find-my-way v9 / brace-expansion v5 incompatible |
| `desktop-client/package.json` | Version: `1.2.11` (stable) |

---

## 3. Next Steps

1. **Audit phase 3**:
   - CRITICAL: C-AUD-01 rate limiting (`@fastify/rate-limit` present, not wired), C-AUD-02 ffprobe DNS rebinding
   - HIGH: H-AUD-01 CSP, H-AUD-02 Docker runner dev-dep bloat, H-AUD-03 process.env overwrite, H-AUD-04 trustProxy IP restriction, H-AUD-05 busyGuild TOCTOU, H-AUD-06 Socket.IO payload scope, H-AUD-07 log redaction dev mode
2. **Fastify v5 upgrade** — unblocks find-my-way CVE-2026-47219 and fast-uri CVEs
3. **`displayMediaFull`** — worker reads Guild row, injects flag into Socket.IO payload, client applies CSS
4. **L-01** — tsconfig strict flags (blocked by `ignoreDeprecations: "6.0"`)
5. **UI redesign** — announced to users in v1.2.11 release notes, in progress when available

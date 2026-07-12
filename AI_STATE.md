# AI_STATE.md — LiveChat CCB

## Status
Sprint `bugfix/socket-room-sync` — COMPLETE. Security remediation (B1 input validation, B2 DOM XSS, B3 type fidelity, C1 trigger-test-format JS injection) applied on top of delta presence sync. All REVIEWER NO-GOs cleared. Branch ready for PR → `develop`.

---

## 1. Accomplished (all sprints)

**Security Remediation — `bugfix/socket-room-sync` (all REVIEWER NO-GOs cleared):**
- **B1** `desktop-client/src/main.ts`: Added `OVERLAY_POSITION_ALLOWLIST`; `normalizeSettings` now rejects any `overlayPosition` not in the allowlist, coercing to `center`. Eliminates JS injection via single-quote break in `executeJavaScript` template and untrusted URL param.
- **B2** `src/components/client/client.html`: Replaced `generateImg`/`generateAudioVideo` HTML-string returns with DOM factory functions (`document.createElement`). `displayContent` uses `replaceChildren()`/`appendChild()`; all clear-only `innerHTML = ''` calls converted to `replaceChildren()`. No user-supplied string reaches `innerHTML`.
- **B3** `src/services/presenceStore.ts`: Introduced `CorePresenceFields` base type; `InternalPresenceEntry` now only carries `{ CorePresenceFields & discordUserId }` (no phantom `id`); `PublicPresenceEntry` adds `id`. Inline mirror in `presenceStore.test.ts` updated to match — phantom `id: discordUserId` removed from `add()`.
- **C1** `desktop-client/src/main.ts`: Added `FORMAT_ALLOWLIST` (`landscape`, `square`, `portrait`, `stop`) alongside `OVERLAY_POSITION_ALLOWLIST`. `overlay:trigger-test-format` IPC handler now validates `format` against `FORMAT_ALLOWLIST`, coercing unknown values to `stop` before interpolation into `executeJavaScript`. Raw `format` no longer reaches the JS template literal.
- **Dead code** `desktop-client/src/renderer/renderer.js`: Removed unused `escapeHtml` function and its stale reference comment. All user text already uses `textContent` (XSS-safe).

**Delta Presence Sync — `bugfix/socket-room-sync`:**
- `src/services/presenceStore.ts`: `PublicPresenceEntry` exposes `id: string` (= `discordUserId`). Added `getSocketEntries(socketId)` read-only lookup method.
- `src/loaders/socketLoader.ts`: Replaced full-list `presence:update` broadcast with delta model:
  - On join (valid session): sends `presence:update` snapshot to joining socket only; broadcasts `userJoined` delta to room peers.
  - On disconnect: arms 3 s debounce timer per `${guildId}:${discordUserId}`; timer emits `userLeft` + calls `presenceStore.removeSocket()`.
  - On reconnect within debounce window: cancels pending timer — no `userLeft`/`userJoined` emitted; seamless UX for micro-disconnects.
- `src/components/client/client.html`: Socket.IO listeners for `userJoined` / `userLeft` forward payloads via `window.livechatOverlay`.
- `desktop-client/src/overlay-preload.ts`: Exposes `reportUserJoined` and `reportUserLeft` IPC senders.
- `desktop-client/src/main.ts`: Forwards `presence:userJoined` / `presence:userLeft` IPC messages from overlay window to control window.
- `desktop-client/src/preload.ts`: `PresenceEntry` type gains `id`; added `onUserJoined` / `onUserLeft` IPC listeners to `window.livechat` API.
- `desktop-client/src/renderer/renderer.js`: Full rewrite of presence rendering — O(1) delta DOM via `data-user-id`; fade+slide-in (180 ms) on join, collapse+fade-out (160 ms) on leave; `prefers-reduced-motion` honoured; WCAG 2.1 AA (`role="list"`, `aria-live="polite"`, `aria-label` on counter); 60 s polling fallback retained; snapshot reconciliation on re-join.
- `desktop-client/src/renderer/index.html`: `#userList` carries `role="list"` + `aria-live="polite"` + `aria-relevant="additions removals"`.
- `desktop-client/src/renderer/styles.css`: `userItemEnter` keyframe animation; `prefers-reduced-motion` override.
- `src/__tests__/services/presenceStore.test.ts` (NEW): 9 unit tests for `getSocketEntries()`, `get()` id field, add/replace idempotence. 2 async tests for debounce cancel vs. fire logic. **Total: 65 tests, 7 files.**

**Single Instance Lock — `bugfix/single-instance-lock`:**
- `desktop-client/src/main.ts`: `app.requestSingleInstanceLock()` before `whenReady`; secondary instances quit silently.
- `app.on('second-instance', …)`: recreates `controlWindow` if null, calls `showControlWindow()`.

**Observability & Production Readiness:**
- `GET /health` / `GET /health/ready` Fastify plugin; HEALTHCHECK in Dockerfile; structured Pino logs; correlation-id hook.
- B1–B4 security patches; 54 prior tests across 6 files.

**Trivy / ESLint / OWASP:** CVE remediations, SHA-pinned CI, XSS guards, secure cookies.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/presenceStore.ts` | In-memory presence store; `CorePresenceFields` base type; `PublicPresenceEntry` exposes `id`; `InternalPresenceEntry` has no phantom `id`; `getSocketEntries()` for debounce lookup |
| `src/loaders/socketLoader.ts` | Socket.IO handler; delta events `userJoined`/`userLeft`; 3 s disconnect debounce |
| `src/components/client/client.html` | Browser overlay; DOM-factory media rendering (no innerHTML XSS); forwards `userJoined`/`userLeft` via `livechatOverlay` IPC bridge |
| `desktop-client/src/overlay-preload.ts` | Exposes `reportPresence`, `reportUserJoined`, `reportUserLeft` to overlay context |
| `desktop-client/src/main.ts` | Electron main; `OVERLAY_POSITION_ALLOWLIST` + `FORMAT_ALLOWLIST` guard all `executeJavaScript` sinks; forwards all three presence IPC events to control window |
| `desktop-client/src/preload.ts` | `window.livechat` API; `onUserJoined`/`onUserLeft` listeners |
| `desktop-client/src/renderer/renderer.js` | Delta DOM mutations; reconcile on snapshot; 60 s polling fallback; WCAG AA; no dead code |
| `desktop-client/src/renderer/index.html` | `#userList` with `role="list"` + `aria-live` |
| `desktop-client/src/renderer/styles.css` | `userItemEnter` keyframe; reduced-motion override |
| `src/__tests__/services/presenceStore.test.ts` | 11 new tests (presenceStore delta + debounce logic) |
| `src/__tests__/` | 7 files, 65 tests total |

---

## 3. Next steps

1. **PR** `bugfix/socket-room-sync` → `develop`.
2. **`feature/security-remediation`** — fastify v5 (CVE-2026-25223 + fast-uri CVEs), tar upgrade, SRI for Tailwind CDN, pnpm v10.
3. **`feature/network-media-optim`** — media by URL, compression, cache.
4. **Observability phase 2** — external log shipping (Loki/ELK), Docker log rotation config fine-tuning.

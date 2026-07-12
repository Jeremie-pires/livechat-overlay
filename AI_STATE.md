# AI_STATE.md — LiveChat CCB

## Status
Sprint `bugfix/presence-and-security-hardening` — COMPLETE.

- **H1** (self not visible): Fixed. `buildUserItem`, `addUserToList`, `reconcileUserList` in `renderer.js` now guard against missing `id` — skip and log-once. `reconcileUserList` filters snapshot to `validSnapshot` before building the DOM key map, preventing `undefined`-id entries from collapsing the list. `app:get-presence` now typed and validated end-to-end with `isPresenceArray` (M2).
- **H2** (self in snapshot): Confirmed correct — `presenceStore.add` precedes `socket.emit('presence:update')` in `socketLoader.ts`. No change required.
- **H3** (dashboard no initial SSE snapshot): Fixed. `GET /api/presence-events` in `dashboardRoutes.ts` writes current `presenceStore.getAll()` as an SSE `presence` event immediately after the `: connected` frame, before calling `presenceSse.register`. Dashboard now reflects connected clients instantly on open.
- **M1** (SSRF in `app:test-connection`): Fixed. `assertHttpUrl` added; `app:test-connection` rejects non-http(s) URLs before fetching. Also applied to `getOverlayUrl`.
- **M2** (`app:get-presence` unchecked cast + missing `id`): Fixed. Runtime guard `isPresenceArray` validates response; return type changed to `Promise<PresenceEntry[]>` with `id` included; malformed responses return `[]`.
- **L1** (`catch (err: any)` in `connectOverlay`): Fixed. Changed to `catch (err: unknown)` + `errMessage(err)` helper.
- **L2** (`normalizeSettings.overlaySize` unbounded): Fixed. `clampOverlaySize(v)` enforces `[MIN_OVERLAY_SIZE=320, MAX_OVERLAY_SIZE=3840]` with rounding. Applied in `normalizeSettings` (now in `utils.ts`).
- **L3** (`normalizeSettings.backendUrl` no scheme validation): Fixed. `assertHttpUrl` validates scheme in `normalizeSettings`; falls back to `DEFAULT_BACKEND_URL` on failure.
- **I1** (presence IPC forwarders unvalidated): Fixed. `presence:update` validates with `isPresenceArray`; `presence:userJoined` validates with `isPresenceEntry`; `presence:userLeft` checks `id: string` before forwarding.

Previous: `bugfix/restrict-auto-update` — COMPLETE.
Previous: `bugfix/socket-room-sync` — COMPLETE.

---

## 1. Accomplished (all sprints)

**Presence & Security Hardening — `bugfix/presence-and-security-hardening`:**
- **`desktop-client/src/utils.ts`** (NEW): Pure, electron-free module exporting `AppSettings`, `PresenceEntry`, `DEFAULT_BACKEND_URL`, `DEFAULT_SETTINGS`, `OVERLAY_POSITION_ALLOWLIST`, `MIN_OVERLAY_SIZE`, `MAX_OVERLAY_SIZE`, `errMessage`, `assertHttpUrl`, `clampVolume`, `clampOverlaySize`, `isPresenceEntry`, `isPresenceArray`, `normalizeSettings`. Enables unit testing without Electron.
- **`desktop-client/src/main.ts`**: Removed duplicated definitions (now imported from `utils.ts`). Applied M1, M2, L1, L2, L3, I1. `getOverlayUrl` uses `assertHttpUrl`. Total file footprint reduced.
- **`src/components/dashboard/dashboardRoutes.ts`**: H3 fix — push `presenceStore.getAll()` as initial SSE `presence` event on register.
- **`desktop-client/src/renderer/renderer.js`**: H1 fix — `buildUserItem` returns `null` on missing `id` (log-once); `addUserToList` early-returns on missing `id`; `reconcileUserList` filters to `validSnapshot` before DOM reconciliation.
- **`src/__tests__/desktop-client/utils.test.ts`** (NEW): 43 unit tests covering `errMessage`, `assertHttpUrl`, `clampVolume`, `clampOverlaySize`, `isPresenceEntry`, `isPresenceArray`, `normalizeSettings`. **Total: 8 files, 108 tests.**

**Auto-Update Stable Lock — `bugfix/restrict-auto-update`:**
- `desktop-client/src/main.ts` `setupAutoUpdater()`: `allowPrerelease = false`, `channel = 'latest'`.

**Security Remediation — `bugfix/socket-room-sync`:**
- B1–C1 security patches; dead code removed. All REVIEWER NO-GOs cleared.

**Delta Presence Sync — `bugfix/socket-room-sync`:**
- Delta model (`userJoined`/`userLeft`), 3 s debounce, WCAG AA renderer, snapshot reconciliation.

**Single Instance Lock — `bugfix/single-instance-lock`:**
- `app.requestSingleInstanceLock()`.

**Observability & Production Readiness:**
- `GET /health`, HEALTHCHECK, Pino structured logs, correlation-id.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `desktop-client/src/utils.ts` | Pure helpers + types; no Electron dependency; fully unit-testable |
| `desktop-client/src/main.ts` | Electron main; imports all helpers from `utils.ts`; M1/M2/L1/L2/L3/I1 applied |
| `src/services/presenceStore.ts` | In-memory presence store; `PublicPresenceEntry` exposes `id`; `getSocketEntries()` |
| `src/loaders/socketLoader.ts` | Socket.IO handler; delta events `userJoined`/`userLeft`; 3 s debounce |
| `src/components/client/client.html` | Browser overlay; DOM-factory rendering; forwards presence IPC events |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; initial snapshot push on register (H3 fix) |
| `desktop-client/src/overlay-preload.ts` | IPC senders for `reportPresence`, `reportUserJoined`, `reportUserLeft` |
| `desktop-client/src/preload.ts` | `window.livechat` API; typed `PresenceEntry` with `id` |
| `desktop-client/src/renderer/renderer.js` | Delta DOM; H1 id guards; no dead code |
| `src/__tests__/desktop-client/utils.test.ts` | 43 tests for pure helpers |
| `src/__tests__/` | 8 files, 108 tests total |

---

## 3. Next steps

1. **PR** `bugfix/presence-and-security-hardening` → `develop`.
2. **PR** `bugfix/restrict-auto-update` → `develop`.
3. **`feature/security-remediation`** — fastify v5 (CVE-2026-25223 + fast-uri CVEs), tar upgrade, SRI for Tailwind CDN, pnpm v10.
4. **`feature/network-media-optim`** — media by URL, compression, cache.
5. **Observability phase 2** — external log shipping (Loki/ELK), Docker log rotation config fine-tuning.

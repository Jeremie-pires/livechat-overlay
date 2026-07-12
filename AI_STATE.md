# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/security-remediation` — COMPLETE.

- **P0 (SSRF in `content-utils.ts`)**: Fixed. New `src/services/url-guard.ts` exports `assertPublicHttpUrl(url): Promise<URL>`, `isPrivateIp(addr)`, and `SsrfBlockedError`. Guards: scheme allow-list (http/https only), literal IP block-list (loopback, RFC1918, link-local, ULA, unspecified, broadcast), IPv4-mapped IPv6 (both dotted-decimal and URL-normalized hex forms), DNS resolution check (fail closed on private resolution or lookup failure). Called at entry of `getContentInformationsFromUrl` before any network use.
- **P1 (Path Traversal in `clientRoutes.ts`)**: Fixed. New `resolveWithinDir(baseDir, filename): string | null` exported pure helper: enforces `^[\w.-]+$` charset, extension allow-list (svg/png/jpg/jpeg/webp), and `resolve()`-based containment check (`target.startsWith(IMG_DIR + sep)`). `/img/:filename` route uses this helper — returns 400 on blocked input, 404 on missing file.

Previous: `bugfix/presence-and-security-hardening` — COMPLETE.
Previous: `bugfix/restrict-auto-update` — COMPLETE.
Previous: `bugfix/socket-room-sync` — COMPLETE.

---

## 1. Accomplished (all sprints)

**Security Remediation — `feature/security-remediation`:**
- **`src/services/url-guard.ts`** (NEW): Pure, framework-free module exporting `SsrfBlockedError`, `isPrivateIp`, `assertPublicHttpUrl`. Covers IPv4 private ranges, IPv6 (loopback, link-local, ULA, IPv4-mapped in both dotted-decimal and URL-normalized hex forms), DNS resolution check (fail closed). No new heavyweight deps — uses `node:dns`, `node:net`.
- **`src/services/content-utils.ts`**: Imports and calls `assertPublicHttpUrl(url)` at entry of `getContentInformationsFromUrl`; rejects private/invalid URLs before any `fetch` or `ffprobe` invocation.
- **`src/components/client/clientRoutes.ts`**: Exports `resolveWithinDir(baseDir, filename): string | null`. `IMG_DIR` computed once from `__dirname`. `/img/:filename` route uses the helper — 400 on traversal/bad-charset/disallowed-ext, 404 on missing-but-contained file. Replaced `join` with `resolve` throughout static routes.
- **`src/__tests__/services/url-guard.test.ts`** (NEW): 49 tests covering `isPrivateIp` (IPv4 + IPv6 ranges) and `assertPublicHttpUrl` (scheme, literal IPs, DNS mocking).
- **`src/__tests__/components/clientRoutes.test.ts`** (NEW): 22 tests covering `resolveWithinDir` (legitimate names, traversal payloads, extension allow-list).
- **Total: 10 files, 179 tests. All passing. `pnpm lint` clean.**

**Presence & Security Hardening — `bugfix/presence-and-security-hardening`:**
- **`desktop-client/src/utils.ts`** (NEW): Pure, electron-free module exporting `AppSettings`, `PresenceEntry`, `DEFAULT_BACKEND_URL`, `DEFAULT_SETTINGS`, `OVERLAY_POSITION_ALLOWLIST`, `MIN_OVERLAY_SIZE`, `MAX_OVERLAY_SIZE`, `errMessage`, `assertHttpUrl`, `clampVolume`, `clampOverlaySize`, `isPresenceEntry`, `isPresenceArray`, `normalizeSettings`. Enables unit testing without Electron.
- **`desktop-client/src/main.ts`**: Removed duplicated definitions (now imported from `utils.ts`). Applied M1, M2, L1, L2, L3, I1. `getOverlayUrl` uses `assertHttpUrl`. Total file footprint reduced.
- **`src/components/dashboard/dashboardRoutes.ts`**: H3 fix — push `presenceStore.getAll()` as initial SSE `presence` event on register.
- **`desktop-client/src/renderer/renderer.js`**: H1 fix — `buildUserItem` returns `null` on missing `id` (log-once); `addUserToList` early-returns on missing `id`; `reconcileUserList` filters to `validSnapshot` before DOM reconciliation.
- **`src/__tests__/desktop-client/utils.test.ts`** (NEW): 43 unit tests covering `errMessage`, `assertHttpUrl`, `clampVolume`, `clampOverlaySize`, `isPresenceEntry`, `isPresenceArray`, `normalizeSettings`.

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
| `src/services/url-guard.ts` | SSRF guard: scheme + IP block-list + DNS check; `SsrfBlockedError`, `isPrivateIp`, `assertPublicHttpUrl` |
| `src/services/content-utils.ts` | Media URL info; calls `assertPublicHttpUrl` at entry (P0 fix) |
| `src/components/client/clientRoutes.ts` | Static client routes; `resolveWithinDir` containment guard for `/img/:filename` (P1 fix) |
| `desktop-client/src/utils.ts` | Pure helpers + types; no Electron dependency; fully unit-testable |
| `desktop-client/src/main.ts` | Electron main; imports all helpers from `utils.ts`; M1/M2/L1/L2/L3/I1 applied |
| `src/services/presenceStore.ts` | In-memory presence store; `PublicPresenceEntry` exposes `id`; `getSocketEntries()` |
| `src/loaders/socketLoader.ts` | Socket.IO handler; delta events `userJoined`/`userLeft`; 3 s debounce |
| `src/components/client/client.html` | Browser overlay; DOM-factory rendering; forwards presence IPC events |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; initial snapshot push on register (H3 fix) |
| `desktop-client/src/overlay-preload.ts` | IPC senders for `reportPresence`, `reportUserJoined`, `reportUserLeft` |
| `desktop-client/src/preload.ts` | `window.livechat` API; typed `PresenceEntry` with `id` |
| `desktop-client/src/renderer/renderer.js` | Delta DOM; H1 id guards; no dead code |
| `src/__tests__/` | 10 files, 179 tests total |

---

## 3. Next steps

1. **PR** `feature/security-remediation` → `develop`.
2. **PR** `bugfix/presence-and-security-hardening` → `develop`.
3. **PR** `bugfix/restrict-auto-update` → `develop`.
4. **`feature/network-media-optim`** — media by URL, compression, cache.
5. **Observability phase 2** — external log shipping (Loki/ELK), Docker log rotation config fine-tuning.

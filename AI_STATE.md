# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/gif-link-support` — IN PROGRESS.

- **GIF Link Support**: Tenor/Giphy landing-page URLs now resolved to raw media via OpenGraph extraction before entering the existing detection pipeline. Both the input URL and every extracted URL pass through `assertPublicHttpUrl` (double SSRF validation). 7 new tests added; total 193/193 passing, `pnpm lint` clean.

Previous: `feature/security-remediation` — COMPLETE (REVIEWER GO ✅).
Previous: `bugfix/presence-and-security-hardening` — COMPLETE.
Previous: `bugfix/restrict-auto-update` — COMPLETE.
Previous: `bugfix/socket-room-sync` — COMPLETE.

---

## 1. Accomplished (all sprints)

**GIF Link Support — `feature/gif-link-support`:**
- **`src/services/content-utils.ts`** (UPDATED): Added `isSupportedGifProvider`, `parseOpenGraph`, `resolveProviderMediaUrl` private helpers. `getContentInformationsFromUrl` calls `resolveProviderMediaUrl` after the input SSRF gate; uses resolved `effectiveUrl` for all downstream detection (extension, fetch, ffprobe). Both input URL and extracted OG URL are independently SSRF-validated. Fetch to provider HTML page is size-capped (256 KB slice) and timeout-guarded (5 s via `Promise.race`). All failure paths log via `logger.debug`.
- **`src/__tests__/services/content-utils.test.ts`** (UPDATED): 7 new tests — Tenor MP4 resolution, Giphy image fallback, SSRF rejection on extracted URL, non-provider regression, empty HTML fallthrough, `eviltenor.com` allow-list bypass, attribute-reversed OG tag parsing. Total: 193 tests.

**Security Remediation — `feature/security-remediation`:**
- **`src/services/url-guard.ts`** (NEW + Q-2): Pure, framework-free module exporting `SsrfBlockedError`, `isPrivateIp`, `assertPublicHttpUrl`. DNS catch uses `instanceof Error` narrowing (Q-2). No new deps — `node:dns`, `node:net` only.
- **`src/services/content-utils.ts`** (B-1 + Q-1): `assertPublicHttpUrl(url)` at entry. `fetch(url, { redirect: 'error' })` closes the redirect-bypass vector. Three catch blocks log via `logger.debug`.
- **`src/components/client/clientRoutes.ts`**: Exports `resolveWithinDir(baseDir, filename): string | null`. `IMG_DIR` computed once from `__dirname`. `/img/:filename` route uses the helper — 400 on traversal/bad-charset/disallowed-ext, 404 on missing-but-contained file.
- **`src/__tests__/services/url-guard.test.ts`** (NEW): 49 tests covering `isPrivateIp` (IPv4 + IPv6 ranges) and `assertPublicHttpUrl` (scheme, literal IPs, DNS mocking).
- **`src/__tests__/components/clientRoutes.test.ts`** (NEW): 22 tests covering `resolveWithinDir` (legitimate names, traversal payloads, extension allow-list).
- **`src/__tests__/services/content-utils.test.ts`** (UPDATED): 7 regression tests — redirect:error wiring, redirect rejection end-to-end, logger.debug on error, normal flow.

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
| `src/services/content-utils.ts` | Media URL info; GIF provider extraction (Tenor/Giphy OG); double SSRF validation; calls `assertPublicHttpUrl` at entry and on every extracted URL |
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
| `src/__tests__/services/content-utils.test.ts` | GIF provider extraction + redirect:error regression tests (193 total) |
| `src/__tests__/` | 11 files, 193 tests total |

---

## 3. Next steps

1. **REVIEWER** `feature/gif-link-support` → awaiting GO/NO-GO on `.pipeline/review.md`.
2. **PR** `feature/gif-link-support` → `develop`.
3. **PR** `feature/security-remediation` → `develop`.
4. **PR** `bugfix/presence-and-security-hardening` → `develop`.
5. **PR** `bugfix/restrict-auto-update` → `develop`.
6. **`feature/network-media-optim`** — media by URL, compression, cache.
7. **Observability phase 2** — external log shipping (Loki/ELK), Docker log rotation config fine-tuning.

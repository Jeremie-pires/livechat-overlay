# AI_STATE.md — LiveChat CCB

## Status
Sprint `hotfix/youtube-regression-1.2.7` — ALL FIXES COMPLETE, version bumped to `1.2.8-rc.1`.

Previous: `feature/gif-link-support` — IN PROGRESS (awaiting REVIEWER).
Previous: `feature/security-remediation` — COMPLETE (REVIEWER GO ✅).
Previous: `bugfix/presence-and-security-hardening` — COMPLETE.
Previous: `bugfix/restrict-auto-update` — COMPLETE.
Previous: `bugfix/socket-room-sync` — COMPLETE.

---

## 1. Accomplished (all sprints)

**YouTube Regression Hotfix + GIF + Telemetry — `hotfix/youtube-regression-1.2.7` → `1.2.8-rc.1`:**

- **`src/services/content-utils.ts`** (UPDATED): `isYouTubeUrl` early-return with `YOUTUBE_CONTENT_TYPE` sentinel. `resolveProviderMediaUrl` for Tenor/Giphy OG extraction. **Now returns `resolvedUrl`** — the CDN media URL extracted from OG tags — so clients receive the playable CDN URL instead of the provider page URL.
- **`src/services/telemetry.ts`** (NEW): Extracted `measureContentProcessing` + `ContentInfo` type from commands into a dedicated service. All four message commands import from here.
- **`src/components/messages/sendCommand.ts`** (UPDATED): Uses `additionalContent?.resolvedUrl ?? url` in queue content. Fixed `finalDuration = 0` regression for YouTube (now stays `undefined` → falls back to guild default).
- **`src/components/messages/hidesendCommand.ts`** (UPDATED): Same fixes as sendCommand. Cognitive complexity reduced from 28 → 14 (extracted `parseDuration`, `detectShortFromAttachment` helpers; `??` assignments replace `&&`-guarded `if` blocks). Fixed `deferReply({ flags: … })` TS2769 → `deferReply({ ephemeral: true })`.
- **`src/components/messages/talkCommand.ts` / `hidetalkCommand.ts`** (UPDATED): Import `measureContentProcessing` from `telemetry.ts`.
- **`src/components/messages/messagesWorker.ts`** (UPDATED): Fixed `ingestionMs` double-counting `processingMs` — formula now subtracts `lastMessage.processingMs` so total latency is accurate. Writes full per-component telemetry to `Stats` and `LatencySample` tables.
- **`src/components/api/statsRoutes.ts`** (UPDATED): Returns per-component averages (`avgIngestionMs`, `avgQueueWaitMs`, `avgProcessingMs`, `avgEmitMs`) and `queueWaitSamples` alongside existing `samples`.
- **`src/components/dashboard/dashboardRoutes.ts`** (UPDATED): Sparkline renamed "Latence totale" (was incorrectly labelled "Attente en file"). Added "Décomposition de la latence" breakdown panel with four tiles (Ingestion Discord / Traitement média / Attente en file / Émission Socket).
- **`prisma/schema.prisma`** (UPDATED): Added `Stats`, `LatencySample`, `BotEvent`, `ClientSession` models.
- **`desktop-client/package.json`**: Bumped to `1.2.8-rc.1`.
- **Desktop version display** (NEW): `Version : {version}` shown below the status label in the control window. `main.ts` exposes `app:get-version` IPC, `preload.ts` bridges it as `window.livechat.getVersion()`, `renderer.js` fetches it in `refreshUi()`, `index.html` + `styles.css` provide the `#appVersion` element with `.version-label` styling.

**Reviewer NO-GO remediation (previous pass):**
- `vi.clearAllMocks()` in `beforeEach` (B-1). `isYouTubeUrl` `/watch` path fixed (N-1). Dead `?? false` / `|| false` removed (N-2). T-10, T-12–T-17 added (N-3). Total tests: ≥210.

**GIF Link Support — `feature/gif-link-support`:**
- `resolveProviderMediaUrl` + `parseOpenGraph` in `content-utils.ts`. Double SSRF validation. `resolvedUrl` now returned and stored in queue content.

**Security Remediation — `feature/security-remediation`:**
- `src/services/url-guard.ts` (NEW): `SsrfBlockedError`, `isPrivateIp`, `assertPublicHttpUrl`. `redirect: 'error'` fetch.
- `src/components/client/clientRoutes.ts`: `resolveWithinDir` path-traversal guard.

**Presence & Security Hardening — `bugfix/presence-and-security-hardening`:**
- `desktop-client/src/utils.ts` (NEW): Pure helpers, fully unit-testable.
- Delta presence model (`userJoined`/`userLeft`), 3 s debounce.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/url-guard.ts` | SSRF guard: scheme + IP block-list + DNS check |
| `src/services/content-utils.ts` | Media URL info; YouTube early-return; GIF OG extraction; returns `resolvedUrl` |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo` type; used by all 4 message commands |
| `src/components/client/clientRoutes.ts` | Static client routes; `resolveWithinDir` containment guard |
| `src/components/messages/messagesWorker.ts` | Dequeues messages; writes per-component telemetry; fixed `ingestionMs` formula |
| `src/components/api/statsRoutes.ts` | GET /api/stats; returns per-component latency averages |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; latency breakdown panel |
| `desktop-client/src/utils.ts` | Pure helpers + types; no Electron dependency |
| `src/services/presenceStore.ts` | In-memory presence store |
| `src/loaders/socketLoader.ts` | Socket.IO handler; delta events; 3 s debounce |
| `src/__tests__/services/content-utils.test.ts` | YouTube (T-1…T-17) + GIF + redirect tests (≥210 total) |

---

## 3. Next steps

1. **TEST** `1.2.8-rc.1` — validate YouTube links, Tenor/Giphy GIFs, dashboard latency breakdown, and version label in staging.
2. **PR** `hotfix/youtube-regression-1.2.7` → `develop` (then cherry-pick to release line → tag `1.2.8`).
3. **REVIEWER** `feature/gif-link-support` → awaiting GO/NO-GO on `.pipeline/review.md`.
4. **PR** `feature/gif-link-support` → `develop`.
5. **PR** `feature/security-remediation` → `develop`.
6. **PR** `bugfix/presence-and-security-hardening` → `develop`.
7. **`feature/network-media-optim`** — media by URL, compression, cache.
8. **Observability phase 2** — external log shipping (Loki/ELK).

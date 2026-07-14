# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/network-optimization` — IN PROGRESS (all acceptance criteria met; 268 tests green, lint clean).

Previous: `feature/crud-database-dashboard` — IN PROGRESS (awaiting REVIEWER GO).
Previous: `hotfix/youtube-regression-1.2.7` — RELEASED as `1.2.8` (stable).
Previous: `feature/security-remediation` — COMPLETE (REVIEWER GO ✅).

---

## 1. Accomplished (all sprints)

**Network optimization + security hardening — `feature/network-optimization`:**
- **`src/services/url-guard.ts`** (UPDATED): `assertPublicHttpUrl` now returns `AssertedUrl { url: URL; ip: string; family: 4|6 }` — validated IP returned to caller, enabling TOCTOU-safe fetch pinning. Literal-IP path returns IP directly without DNS; hostname path returns first public resolved address.
- **`src/services/content-utils.ts`** (UPDATED):
  - `buildPinnedFetchArgs`: helper builds IP-pinned URL + `Host` header + `https.Agent` with SNI servername; used at all `fetch()` call sites.
  - `readHtmlStreamUntilOg`: streams provider HTML body incrementally; breaks on first OG media match (early cancel via `destroy()`); enforces 256 KB ceiling; handles chunk-boundary-split tags.
  - `resolveProviderMediaUrl`: now calls `assertPublicHttpUrl` for the provider URL itself; uses IP-pinned fetch for HTML; uses streaming via `readHtmlStreamUntilOg`.
  - `getContentInformationsFromUrl`: uses `urlGuard` from initial `assertPublicHttpUrl`; content-type fetch pinned to validated IP (re-validates `effectiveUrl` when it differs from `url`).
- **`src/components/messages/talkCommand.ts`** (UPDATED): null guard for missing audio attachment (early return + cleanup + localized error embed); `mediaDuration ?? 0` prevents `NaN` in DB write; removed unsafe `as string` cast.
- **`src/components/messages/hidetalkCommand.ts`** (UPDATED): same null guard as `talkCommand`; ephemeral `editReply` path for error display.
- **`src/components/messages/messagesWorker.ts`** (UPDATED): `MAX_MEDIA_DURATION_S = 3600` constant; `mediaDuration` narrowed to finite then clamped to `[0, 3600]`; falls back to 5000 ms for invalid/zero values.
- **`src/services/i18n/en.ts` + `fr.ts`** (UPDATED): `talkNoAttachment` key added to both languages.
- **`src/__tests__/services/telemetry.test.ts`** (NEW): 6 tests — return shape, `processingMs ≥ 0`, finite check, passthrough of `contentInfo`, `Date.now` spy for elapsed time, negative-clock clamp to 0, rejection propagation.
- **`src/__tests__/services/url-guard.test.ts`** (UPDATED): new `assertPublicHttpUrl — return shape` describe block (5 tests) asserting `{ url, ip, family }` for hostname/IPv4/IPv6 literal inputs; scheme/loopback/DNS suites updated to use `.url` property.
- **`src/__tests__/services/content-utils.test.ts`** (UPDATED): `makeHtmlResponse` now provides async-iterable `.body`; redirect policy test asserts IP-pinned URL + `Host` header; new streaming suite (5 tests): early cancel on OG hit, always-destroy cleanup, 256 KB ceiling, chunk-boundary split, provider fetch is IP-pinned.

**Prior sprints:** DB Viewer + Broadcast Logging, YouTube hotfix (1.2.8), GIF/Tenor/Giphy OG extraction, telemetry service, SSRF url-guard, presence delta model — all complete.

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `src/services/url-guard.ts` | SSRF guard → `AssertedUrl { url, ip, family }`; scheme + IP blocklist + DNS check |
| `src/services/content-utils.ts` | Streaming OG parse; IP-pinned fetch at all sites; YouTube early-return; ReDoS-safe regex |
| `src/services/telemetry.ts` | `measureContentProcessing(url)` + `ContentInfo`; used by all 4 message commands |
| `src/components/messages/talkCommand.ts` | Null-attachment guard; `mediaDuration ?? 0`; no unsafe cast |
| `src/components/messages/hidetalkCommand.ts` | Same null guard; ephemeral editReply error path |
| `src/components/messages/messagesWorker.ts` | `mediaDuration` clamped `[0, 3600]`; 5 s fallback for invalid |
| `src/services/broadcastClassifier.ts` | Pure: `classifyDiscordError`, `persistBroadcastRun` (fail-safe), `mintRunId` |
| `src/services/broadcast.ts` | `broadcastToAllGuilds()` → `BroadcastResult[]`; no swallowed errors |
| `src/components/api/adminDbRoutes.ts` | Owner-only DB admin endpoints |
| `src/components/dashboard/dashboardRoutes.ts` | Dashboard + SSE; latency breakdown; DB page |
| `desktop-client/src/main.ts` | Electron main; `assertHttpUrl` used at every fetch-URL construction site |

---

## 3. Next steps

1. **REVIEWER** `feature/network-optimization` → SonarQube gate + 268 tests green; submit for GO.
2. **PR** `feature/network-optimization` → `develop` (squash merge after GO).
3. **REVIEWER** `feature/crud-database-dashboard` → re-submit for final GO.
4. **PR** `feature/crud-database-dashboard` → `develop`.
5. **PR** `feature/gif-link-support` → `develop`.
6. **PR** `feature/security-remediation` → `develop`.
7. **Observability phase 2** — external log shipping (Loki/ELK).

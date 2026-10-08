# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — session 6 complete. Rate-limit fix + H-AUD-06 sanitization + 6 code-review findings resolved. Ready for PR `develop` → `main` + prod deploy.

---

## 1. Accomplished

### Session 6 (code-review fixes)
- **`allowList` fix** — `server.ts`: `skip` (invalid in @fastify/rate-limit v11, silently ignored) → `allowList`. Socket.io and `/health*` now actually exempt. `isRateLimitExempt` extracted to `src/services/utils.ts`; test imports real predicate (no longer self-referential).
- **Worker sanitize refactor** — `messagesWorker.ts`: spread+delete → destructuring `{ media, ...sanitizedContent }`; promotion guard changed to `== null` (not falsy); `emittedContent = JSON.stringify(sanitizedContent)` cached once — used for both emit and `payloadBytes`; `getMediaType` and `resolveMediaDurationMs` now receive `sanitizedContent` (stats no longer miscategorised).
- **Client mock fix** — `client.html:389`: `__triggerTestFormat` mock changed `media: mediaUrl` → `url: mediaUrl` (regression: test buttons were broken post H-AUD-06 change).
- **Client guard** — `client.html:displayContent`: `if (!data.url) { onDone(); return; }` before media type dispatch — prevents `generateImg(undefined)` / `generateAudioVideo(undefined)` and potential queue stall.
- **HAProxy config** — `docs/infra/haproxy.cfg.example`: reverted both backends to probe `GET /health` (liveness). `/health/ready` returns 503 on Discord flap — would mark backend DOWN despite HTTP server being healthy. README note updated.
- **Tests** — `messagesWorker.sanitize.test.ts`: added `url: ""` case confirming `== null` guard (empty string does NOT trigger promotion). All 377 tests pass.

### Session 5 (TikTok H.264 fix — already on main)
- Format selector `best[ext=mp4][vcodec^=h264]/best[ext=mp4]/best` — forces H.264 over H.265.

---

## 2. Current Architecture (key files)

| File | Role |
|---|---|
| `src/server.ts` | Fastify v5 + Socket.IO; `allowList: isRateLimitExempt` |
| `src/services/utils.ts` | `isRateLimitExempt(req)` exported; used by server + test |
| `src/components/messages/messagesWorker.ts` | Destructuring sanitize; `emittedContent` cached; stats use `sanitizedContent` |
| `src/components/client/client.html` | `displayContent` guards `!data.url`; test mock uses `url:` |
| `src/services/content-utils.ts` | TikTok/Twitter URL sanitization + Cobalt + yt-dlp proxy |
| `src/services/ytdlp.ts` | H.264 format selector; semaphore 5; cookie injection |
| `docs/infra/haproxy.cfg.example` | Probes `GET /health` (liveness only) |

---

## 3. Next Steps

1. **[NEXT]** Commit session 6 changes
2. **[NEXT]** PR `develop` → `main` + prod deploy
3. **[NEXT]** Vérif prod : TikTok + Twitter + boutons test overlay
4. **[LATER]** Fix prod 429 sur `/health` — déjà résolu côté code (`allowList`), vérifier que la config HAProxy prod est bien sur `GET /health`
5. **[LATER]** H-AUD-06 write-side : les 4 commandes (`send`, `hidesend`, `talk`, `hidetalk`) stockent encore `media` en DB. Envisager migration ou write-time sanitization pour couper la surface à la source.
6. **[LATER]** `displayMediaFull` — feature en attente, non prioritaire

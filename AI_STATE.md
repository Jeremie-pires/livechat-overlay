# AI_STATE.md — LiveChat CCB

## Status
Branch `feat/security-quality-audit` (off `develop`). Security + quality audit complete. 416/416 tests pass. Next: push branch, open PR, Sonar gate check, then full test phase.

---

## 1. Accomplished

### Session 33 (security + quality audit — full refactor)

#### Phase 1 — Critical bugs
- `session.ts`: `requireAuth` converted to async (Fastify v5 preHandler must return Promise).
- `utils.ts`: `parseDuration('full', null/undefined)` → `'error'` instead of `0`.
- `content-utils.ts`: `AbortSignal.timeout(10_000)` on fetch + Content-Length > 50 MB guard before `arrayBuffer()`.
- `DiscordLoader.ts`: channel-check block wrapped inside existing try/catch.

#### Phase 2 — Socket token auth
- `prisma/schema.prisma`: `@@unique([discordUserId, guildId])` → `discordUserId String @unique` (one active token per user globally).
- `src/components/discord/clientCommand.ts`: `deleteMany({ where: { discordUserId } })` — invalidates all prior sessions across guilds.
- `src/loaders/socketLoader.ts`: `socket.join(roomId)` moved AFTER token validation; no token or wrong guild → rejected with warn log.
- `prisma/clear-sessions.sql` (NEW): `DELETE FROM ClientSession;` — run on VPS before `pnpm migration:up` to avoid unique constraint conflict.

#### Phase 3 — Server/infra hardening
- `docker-compose.yml`: ports bound to `127.0.0.1` (3000, 9000) — no external exposure.
- `src/services/url-guard.ts`: added CGNAT `100.64.0.0/10`, `fec0::/10`, NAT64 `64:ff9b::/96` to SSRF blocklist.
- `src/components/messages/messagesWorker.ts`: `maxMediaTime` enforced at dequeue (replaced `busyGuild` query with unconditional `guildRow` query + manual busy check).

#### Phase 4 — Electron hardening
- `desktop-client/src/local-server.ts`: CORS restricted to `null` and `http://localhost:*` origins only.
- `desktop-client/src/renderer/renderer.js`: `esc()` function for HTML escaping applied to `r.tag_name` and `r.body` in changelog (XSS closed).
- `desktop-client/src/main.ts`: `will-navigate` guard blocks any URL not starting with `http://localhost:`; `setPermissionRequestHandler` denies camera/mic/notifications.
- `.github/workflows/desktop-release.yml`: `pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`.

#### Phase 5 — Code quality
- `package.json`: `start` script fixed (`dist/index.js`); 7 dead deps removed (`concat-map`, `get-video-duration`, `youtubei.js`, `unify-errors`, `zod-validation-error`, `regenerator-runtime`, `node-gyp`).
- `CLAUDE.md`: updated to Fastify v5, all 7 Prisma models listed.
- Deleted: `.github/workflows/main.disabledyml`, `sonar-project.properties`.
- `src/__tests__/components/messages/parseDuration.test.ts`: updated for `'error'` on `full+undefined/null`.

#### Skipped (non-trivial, next phase)
- Task 17: `noImplicitAny: true` in tsconfig.
- Task 18: 6 `@ts-ignore` removals (need type augmentation for `discordClient.commands`).
- Task 21: `requireSession` preHandler extraction (5 duplications).
- Task 22: embed color constants (~30 hardcoded hex values).

### Session 32 (desktop volume burst fix + OBS volume)
- `playerVolume.js`: `muted: true` always; removed `isDesktop` param.
- `client.html` `can-play`: order now `applyPlayerVolume → unmute → play`.
- `commandHelpers.ts` `computeFinalDuration`: priority now `custom → audioDuration → mediaDuration`.
- OBS volume: `volumeFromUrlParams` reads `?volume=XX`; `local-server.ts` `activeVolume`; `main.ts` calls `setLocalServerVolume`.
- +15 tests. 416/416 pass.

---

## 2. Current State

| Item | State |
|---|---|
| Branch | `feat/security-quality-audit`, off `develop`, uncommitted changes staged |
| Tests | 416/416 vitest |
| Sonar | Gate pending — must check after PR push |
| Prisma | Schema changed — `ClientSession` unique constraint changed; VPS needs `DELETE FROM ClientSession` before `migration:up` |
| Prod | Not yet deployed; `prisma/clear-sessions.sql` must run first |
| TikTok CDN | Unconfirmed, needs `cdnDomain` prod log |

---

## 3. Next Steps

### [IMMEDIATE]
1. Push `feat/security-quality-audit` → open PR against `main`.
2. Sonar gate must be green before merge.
3. VPS deployment order:
   ```bash
   docker compose exec livechatccb sqlite3 /data/sqlite.db "DELETE FROM ClientSession;"
   docker compose up --build -d
   ```
4. Full test phase: write tests for all new behaviors (token auth, parseDuration error, content-utils limits, url-guard SSRF additions, messagesWorker maxMediaTime).

### [LATER — Quality phase 5 remainder]
- Task 17: `noImplicitAny: true` + fix resulting errors.
- Task 18: Remove 6 `@ts-ignore` (type augmentation for `discordClient.commands`).
- Task 21: Extract `requireSession` preHandler.
- Task 22: Embed color constants.
- Logic bugs phase: `/hidetalk`, FIFO order, `busyUntil` reset, etc.
- `presenceStore.test.ts` rewrite against real module.
- TikTok CDN: check `cdnDomain` prod log.
- Electron v33 EOL upgrade (separate ticket).

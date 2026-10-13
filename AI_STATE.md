# AI_STATE.md — LiveChat CCB

## Status
Branch `develop`. PR #75 (`develop → main`) merged. SonarCloud Quality Gate **failed**: 8.8% duplication on New Code (limit ≤ 3%). Fix committed locally on `develop`, **not yet pushed** (PR #77 open on Sonar side).

---

## 1. Accomplished

### Session 30 (Sonar duplication fix + Sonar tooling)
- Root cause (via local `jscpd`): `talkCommand.ts` ≈ `hidetalkCommand.ts` (~32 duplicated lines).
- `commandHelpers.ts`: added `buildTalkCommandData(prefix)` + `executeTalkHandler(interaction, { prefix, ephemeral, withAuthor })` (same pattern as `buildMessageCommandData` / `executeMessageHandler`). `resolveTTSAttachment` / `createTalkQueueEntry` now module-private. Extracted `buildAuthorData()` (was duplicated in message + talk queue creation).
- `talkCommand.ts` / `hidetalkCommand.ts`: reduced to 9-line wrappers.
- Local checks: jscpd 1.11% → 0.59% (remaining clones in files untouched by PR); vitest 386/386; eslint clean on changed files; tsc error count unchanged vs baseline (43, all pre-existing / partial local install).
- `CLAUDE.md`: new section "SonarCloud Quality Gate — must stay green" (pre-push jscpd + lint/tsc/tests, ask user for Sonar result after push, never merge red gate). Also contains uncommitted "Skills priority — agent-skills" section.
- SonarQube MCP server registered (local scope, `~/.claude.json`, not in repo): `docker run -i --rm --init --pull=always -e SONARQUBE_TOKEN -e SONARQUBE_ORG=jeremie-pires sonarsource/sonarqube-mcp`. Token read from user env var only. Now **connected**: project key `Jeremie-pires_livechat-overlay`, PR #77 gate = ERROR (new dup 8.8%, all other conditions OK).
- Found: SonarCloud uses **Automatic Analysis** (no scanner in CI) → reads `.sonarcloud.properties`, ignores `sonar-project.properties`. Our CPD exclusions were never applied (e.g. `presenceStore.ts` flagged as clone of its test). Added `.sonarcloud.properties` with the same `sonar.cpd.exclusions`.

### Session 29 (5-axis code review + mass fix)
- 17 files fixed: OAuth validation, SSRF guard on video proxy, cookie sanitisation, `hashToken` dedup, TTS temp files in `os.tmpdir()`, timers `.unref()`, dead env code removed, typed globals.

### Session 28
- VidstackPlayer error handler; CDN domain logging for TikTok proxy failures.

---

## 2. Current State

| Item | State |
|---|---|
| main | PR #75 merged — Sonar gate red (duplication) |
| Working tree | Clean — session 30 committed, awaiting push |
| Sonar access | SonarQube MCP connected (`SONARQUBE_TOKEN` user env var) |
| Local env | `node_modules` installed via `npx pnpm@9` (`zlib-sync` native build failed — non-blocking for tests). No global `pnpm`. Files are CRLF locally; lint with `endOfLine: auto` |
| Prod containers | `livechatccb` (3000) + `cobalt` (9000) |
| TikTok CDN | Root cause unconfirmed, needs `cdnDomain` log |

---

## 3. Next Steps

### [IMMEDIATE]
1. Push `develop` → re-check gate on PR via MCP (`get_project_quality_gate_status`, pullRequest key) → must be green before merge.

### [AFTER]
- VPS: `git pull && docker compose up --build -d`; send TikTok command, check `cdnDomain` log; if `*.tiktokcdn*.com` → fix `parseCookiesForDomain`.

### [LATER]
- `presenceStore.test.ts` reimplements the store instead of importing it — rewrite test against real module.
- Pre-existing clones (not New Code): `announceCommand`/`announceGuildCommand`/`maintenanceCommand`, `statsRoutes`/`dashboardRoutes` session check, `client.html` 373/765.
- H-AUD-06: 4 commands store `media` in DB instead of `audio`.
- S-1: CSP nonce to replace `unsafe-inline` in dashboard.

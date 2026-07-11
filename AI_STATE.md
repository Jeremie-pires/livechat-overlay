# AI_STATE.md — LiveChat CCB

## Status
Sprint `feature/observability-prod-readiness` — READY TO MERGE. Lead Tech review blockers B1–B4 resolved. All tests green. Branch ready for PR → `develop`.

---

## 1. Accomplished (all sprints)

**Observability & Production Readiness (current branch):**
- `GET /health` — liveness: 200 `{status,env,uptime}`; unauthenticated, no external deps
- `GET /health/ready` — readiness: Prisma `SELECT 1` + `discordClient.isReady()`; 503 with per-dep breakdown on failure
- `HEALTHCHECK` in Dockerfile runner stage (Node-based probe, no curl needed)
- `docker-compose.yml`: added `APP_ENV`, `LOG`, `healthcheck:`, `logging` (json-file 10m×5)
- `docker-compose.dev.yml`: same healthcheck + log rotation additions
- `src/server.ts`: Pino structured JSON in deployed envs (`base` bindings: env/service/version/timestamp), `redact` paths (DISCORD_TOKEN, DISCORD_CLIENT_SECRET, cookies), correlation-id hook (`genReqId` from `x-request-id` or `crypto.randomUUID()`)
- `docs/DEPLOYMENT.md`: zero-downtime runbook (`--wait`, rollback, pre-deploy checklist, HAProxy drain, log rotation)
- 8 new Vitest tests for `/health`, `/health/ready`, correlation-id propagation
- **B1 (security):** `genReqId` validates strict UUID v4 regex (`/^…4…[89ab]…$/i`); non-string, malformed, or non-v4 headers fall through to `crypto.randomUUID()`
- **B2 (reliability):** `onClose` hook moved outside socket.io `try/catch` — always registered, no handle leak on partial init
- **B3 (correctness):** `onClose` param renamed to `_instance`, dead `if (err)` branch removed — Fastify v4 contract honoured
- **B4 (security):** `/health/ready` Prisma error logs full detail server-side; returns `'Database connection failed'` (+ `err.code` when present) — never exposes `err.message`
- 3 new tests: B1 invalid UUID fallback, B1 v1 UUID fallback, B4 sanitized reason, B4 reason with err.code → 54 tests total, 6 files
- **CI fix:** `messagesWorker.test.ts` — added `vi.mock` for `loadPrisma` so `@prisma/client` is never resolved when Prisma client is not generated in CI
- **Lint fix:** `server.ts` — dropped unused `_instance` param from `onClose` async hook; `RESTLoader.ts` — extracted `HealthRoutes()` call to `healthPlugin` const so the import is unambiguously referenced

**Trivy Round 2 — 41 CVEs (commit `a90bfe7`):**
- `find-my-way^8.2.2`, `ws>=8.21.0`, `socket.io-parser>=4.2.6`, `lodash^4.18.0`
- Trivy `skip-dirs`: corepack + esbuild Go stdlib false positives

**Trivy Round 1 — 48 CVEs (commits `f1dfc73`…`1e11d14`):**
- Multi-stage Dockerfile, pnpm overrides, `.trivyignore`

**ESLint + SHA-pinned CI:**
- All 9 GitHub Actions pinned to 40-char SHAs

**OWASP + Vitest:**
- XSS, Secure cookies, `deleteSession`, DSN masking, socket join validation, strict CORS
- 43 prior tests + 8 new = 51 tests, 6 files

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage: builder → runner; HEALTHCHECK Node probe |
| `docker-compose.yml` | APP_ENV default=production, LOG, healthcheck, json-file log rotation |
| `docker-compose.dev.yml` | APP_ENV default=staging, healthcheck, log rotation |
| `docs/DEPLOYMENT.md` | Zero-downtime runbook: health-gated rolling replace, rollback, HAProxy drain |
| `src/components/api/healthRoutes.ts` | `/health` + `/health/ready` Fastify plugin |
| `src/loaders/RESTLoader.ts` | Mounts HealthRoutes at `/` |
| `src/server.ts` | Structured JSON logs (deployed), redact, correlation-id hook, boot log |
| `.trivyignore` | Accepted-risk suppressions |
| `.github/workflows/release.yml` | SHA-pinned; Trivy skip-dirs |
| `src/services/env.ts` | Zod env, `validateEnvCoherence()`, DSN masked |
| `src/services/session.ts` | createSession / getSessionToken / isValidSession / deleteSession |
| `src/components/dashboard/dashboardRoutes.ts` | XSS-safe, Secure cookie, server-side logout |
| `src/__tests__/` | 6 files, ~54 tests |

---

## 3. Next steps

1. **PR** `feature/observability-prod-readiness` → `develop` (suite green, review blockers resolved).
2. **`feature/security-remediation`** — fastify v5 (CVE-2026-25223 + fast-uri CVEs), tar upgrade, SRI for Tailwind CDN, pnpm v10.
3. **`feature/network-media-optim`** — media by URL, compression, cache.
4. **Observability phase 2** — external log shipping (Loki/ELK), Docker log rotation config fine-tuning.

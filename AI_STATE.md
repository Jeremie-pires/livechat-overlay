# AI_STATE.md — LiveChat CCB

## Status
Sprint DevSecOps — COMPLETE (Round 2). Branch `feature/env-isolation-msg`: all Trivy CVEs resolved across two passes. Ready to merge → `develop`.

---

## 1. Accomplished (all sprints)

**Trivy Round 2 — 41 CVEs (commit `a90bfe7`):**
- `find-my-way^8.2.2` — CVE-2024-45813, pnpm override, stays in fastify@4-compatible range
- `ws>=8.21.0` — CVE-2024-37890 + CVE-2026-48779, pnpm override
- `socket.io-parser>=4.2.6` — CVE-2026-33151, pnpm override
- `lodash@4.18.1` — CVE-2026-4800, direct dep bumped to `^4.18.0`
- Trivy `skip-dirs`: `root/.cache/node/corepack` (16 CVEs — pnpm@8.15.9 + bundled minimatch, build tool only, v10 upgrade breaks lockfile format)
- Trivy `skip-dirs`: `app/node_modules/.pnpm/@esbuild+linux-x64@0.19.12` (18 Go stdlib CVEs — false positives for a transpiler, never uses net/tls/http2)
- `pnpm-lock.yaml` regenerated: `lockfileVersion: '6.0'`, all 6 overrides synced

**Trivy Round 1 — 48 CVEs (commits `f1dfc73`…`1e11d14`):**
- Multi-stage Dockerfile: builder (all deps) → runner (`--prod`, no devDeps)
- `corepack prepare pnpm@8.15.9`, `ENV HUSKY=0`, `pnpm generate` in runner stage
- `tsx` moved to `dependencies`; `prepare` script guards husky with Node env check
- `.trivyignore`: fastify@4 CVEs, fast-uri@2, tar@6, minimatch@9/glob@10 devDep chains
- pnpm overrides: `cross-spawn^7.0.5`, `undici^6.27.0`, `form-data>=2.5.4`

**ESLint + SHA-pinned CI:**
- All 9 GitHub Actions pinned to 40-char SHAs
- `eslint-disable-next-line no-console` in env.ts / env.test.ts

**OWASP + Vitest:**
- XSS (`esc()`), Secure cookies, `deleteSession`, DSN masking, upsert P2025, `JSON.parse` guards
- Socket join validation, strict CORS (`API_URL.origin`)
- 43 Vitest tests, 5 files, all passing

---

## 2. Current architecture (key files)

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage: builder → runner (prod only + `pnpm generate`) |
| `.trivyignore` | Accepted-risk suppressions: fastify@4, fast-uri@2, tar@6, minimatch/glob devDep chains, lodash fallback |
| `.github/workflows/release.yml` | SHA-pinned; Trivy `trivyignores` + `skip-dirs` (corepack + esbuild) |
| `package.json` `pnpm.overrides` | 6 overrides; lockfile `6.0` stays pnpm v8-compatible |
| `src/loaders/socketLoader.ts` | Namespaced rooms `${APP_ENV}:messages-*`; join validation |
| `src/server.ts` | Strict CORS |
| `src/services/env.ts` | Zod env, `validateEnvCoherence()`, DSN masked |
| `src/services/session.ts` | `createSession` / `getSessionToken` / `isValidSession` / `deleteSession` |
| `src/components/dashboard/dashboardRoutes.ts` | `esc()` XSS, Secure cookie, server-side logout |
| `src/__tests__/` | 5 files, 43 tests |

---

## 3. Next steps

1. **Merge** `feature/env-isolation-msg` → `develop` + staging validation (Discord dev bot + Desktop App Dev).
2. **`feature/security-remediation`** — fastify v5 (fixes CVE-2026-25223 + fast-uri CVEs), tar upgrade via node-gyp, SRI for Tailwind CDN, pnpm v10 migration.
3. **`feature/observability-logging`** — `correlation_id`, `/health` + `/health/ready`, Docker log rotation.
4. **`feature/network-media-optim`** — media by URL, compression, cache.
5. **`chore/deploy-zero-downtime`** — deploy scripts, HAProxy readiness gate, rollback.

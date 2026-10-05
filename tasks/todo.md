# Todo: TikTok & Twitter/X Video Integration

## Task 1: Env vars — COBALT_API_URL + COBALT_PUBLIC_URL

**Description:** Add two optional env vars to `env.ts` (zod `z.string().url().optional()`) and document them in `.env.example`.

**Acceptance criteria:**
- [ ] `COBALT_API_URL` present in env schema, optional
- [ ] `COBALT_PUBLIC_URL` present in env schema, optional
- [ ] Both present in `.env.example` with example values

**Verification:**
- [ ] `pnpm build` passes
- [ ] `pnpm test` — env.test.ts passes

**Dependencies:** None  
**Files:** `src/services/env.ts`, `.env.example`  
**Scope:** XS

---

## Task 2: URL detectors + Cobalt resolver in content-utils.ts

**Description:** Add `isTikTokUrl()`, `isTwitterUrl()`, `resolveCobaltUrl()` functions. Modify `getContentInformationsFromUrl()` to intercept TikTok/Twitter URLs before the normal pipeline — Cobalt path returns `video/mp4` + stream URL; fallback returns `video/tiktok`/`video/twitter`.

**Acceptance criteria:**
- [ ] `isTikTokUrl()` matches `tiktok.com`, `www.tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`
- [ ] `isTwitterUrl()` matches `twitter.com`, `www.twitter.com`, `x.com`, `www.x.com`
- [ ] `resolveCobaltUrl()` returns stream URL on `tunnel`/`redirect` status
- [ ] `resolveCobaltUrl()` returns `null` when `COBALT_API_URL` is unset
- [ ] `resolveCobaltUrl()` returns `null` on Cobalt error / timeout
- [ ] `getContentInformationsFromUrl()` early-returns for TikTok/Twitter (before SSRF guard, after URL parse)
- [ ] Both functions exported for testability

**Verification:**
- [ ] `pnpm build` TypeScript clean
- [ ] `pnpm test` — no regressions

**Dependencies:** Task 1  
**Files:** `src/services/content-utils.ts`  
**Scope:** M

---

## Checkpoint: After Tasks 1-2
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (existing suite, no regressions)

---

## Task 3: Client iframe fallback in client.html

**Description:** Add `generateIframe()` helper and `extractEmbedUrl()` to extract TikTok video ID / Twitter tweet ID and build embed URLs. Modify `displayContent()` to branch on `video/tiktok`/`video/twitter` types before the existing `generateAudioVideo` path. Add CSS for iframe sizing.

**Acceptance criteria:**
- [ ] `video/tiktok` → TikTok embed iframe `https://www.tiktok.com/embed/v2/{id}?autoplay=1&muted=1&loop=1`
- [ ] `video/twitter` → Twitter embed iframe `https://platform.twitter.com/embed/Tweet.html?id={id}&theme=dark&dnt=true`
- [ ] Iframe fills `#message-block` (width/height 100%, no border)
- [ ] If ID cannot be extracted (e.g. unresolvable URL), empty wrapper returned — duration timeout clears it

**Verification:**
- [ ] `pnpm lint` passes
- [ ] Visual: open `/client` in browser, trigger a test with a TikTok-type mock payload

**Dependencies:** Task 2  
**Files:** `src/components/client/client.html`  
**Scope:** S

---

## Task 4: Docker Compose — Cobalt service

**Description:** Add `cobalt` service to `docker-compose.yml` using `ghcr.io/imputnet/cobalt:10`. Expose port 9000. Pass `COBALT_PUBLIC_URL` as Cobalt's own `API_URL` so tunnel URLs are browser-accessible. Add `COBALT_API_URL` env to `livechatccb` service.

**Acceptance criteria:**
- [ ] `cobalt` service defined in `docker-compose.yml`
- [ ] Cobalt `API_URL` = `${COBALT_PUBLIC_URL:-http://localhost:9000}`
- [ ] Port `9000:9000` exposed
- [ ] `livechatccb` service has `COBALT_API_URL: http://cobalt:9000`

**Verification:**
- [ ] `docker-compose config` shows no YAML errors

**Dependencies:** Task 1  
**Files:** `docker-compose.yml`  
**Scope:** XS

---

## Task 5: Tests — content-utils.cobalt.test.ts

**Description:** New test file covering URL detectors and Cobalt resolver paths. Mock `env` module to control `COBALT_API_URL`. Mock `node-fetch`. Cover: detector functions, Cobalt tunnel response, redirect response, error/timeout fallback, disabled when no env var.

**Acceptance criteria:**
- [ ] `isTikTokUrl` / `isTwitterUrl` test cases cover standard + short + www + non-matching URLs
- [ ] Cobalt `tunnel` response → `contentType: 'video/mp4'`, `resolvedUrl` set
- [ ] Cobalt `redirect` response → `contentType: 'video/mp4'`, `resolvedUrl` = CDN URL
- [ ] Cobalt returns error → falls back to `video/tiktok` / `video/twitter`
- [ ] `COBALT_API_URL` not set → falls back to `video/tiktok` / `video/twitter`
- [ ] Cobalt fetch timeout → fallback

**Verification:**
- [ ] `pnpm test` — all tests green

**Dependencies:** Task 2  
**Files:** `src/__tests__/services/content-utils.cobalt.test.ts`  
**Scope:** M

---

## Checkpoint: Complete
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm build` — TypeScript clean
- [ ] `pnpm lint` — no errors
- [ ] Code review done (`/code-review`)

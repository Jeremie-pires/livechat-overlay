# Implementation Plan: TikTok & Twitter/X Video Integration

**Spec**: `docs/SPEC-tiktok-twitter.md`  
**Branch**: `feature/tiktok-twitter-integration`

## Overview

Integrate TikTok and Twitter/X video URLs into the LiveChat CCB pipeline via a self-hosted Cobalt instance.
Server resolves URLs to stream URLs before queueing — Vidstack plays them natively, zero client changes on the happy path.
If Cobalt is down or unconfigured, custom content types trigger iframe embeds in the client.

## Architecture Decisions

- **Vertical slice order**: env → server logic → client fallback → infra → tests
- **No SSRF guard on Cobalt output**: Cobalt is a trusted env-configured internal service
- **Separate Cobalt test file**: avoids polluting existing content-utils.test.ts mock setup

## Dependency Graph

```
env.ts (COBALT_API_URL / COBALT_PUBLIC_URL)
  └── content-utils.ts (resolveCobaltUrl + URL detectors)
        └── content-utils.cobalt.test.ts (tests)
              └── client.html (iframe fallback branch)
                    └── docker-compose.yml (cobalt service)
```

## Task List

### Phase 1 — Foundation (env + server logic)

- [ ] Task 1: Add `COBALT_API_URL` and `COBALT_PUBLIC_URL` to env.ts + .env.example
- [ ] Task 2: Add URL detectors + Cobalt resolver in content-utils.ts

### Checkpoint: Phase 1
- [ ] `pnpm build` passes (TypeScript clean)
- [ ] `pnpm test` passes (no regressions in existing tests)

### Phase 2 — Client fallback

- [ ] Task 3: Add iframe fallback branch in client.html for `video/tiktok` / `video/twitter`

### Checkpoint: Phase 2
- [ ] `pnpm lint` passes
- [ ] Iframe CSS present, `generateIframe()` implemented

### Phase 3 — Infrastructure

- [ ] Task 4: Add Cobalt service to docker-compose.yml

### Checkpoint: Phase 3
- [ ] docker-compose.yml is valid YAML

### Phase 4 — Tests

- [ ] Task 5: Write `content-utils.cobalt.test.ts` (URL detectors + Cobalt paths)

### Checkpoint: Complete
- [ ] `pnpm test` — all tests pass including new ones
- [ ] `pnpm build` — TypeScript clean
- [ ] Ready for code-review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cobalt API shape changes (v10 → v11) | High | Validate `status` + `url` fields strictly; log unknown statuses |
| Short TikTok links resolve at Cobalt, not server | Low | Cobalt handles internally — no action needed |
| `video/tiktok` iframe autoplay blocked in browser | Med | `muted=1` in TikTok embed URL; duration timeout clears naturally |
| Cobalt tunnel URL uses internal Docker hostname | High | Set Cobalt `API_URL` env = browser-accessible URL (COBALT_PUBLIC_URL) |

# LiveChat CCB — CLAUDE.md

## Project overview

**LiveChat CCB** — Discord bot streams media (images, videos, audio, links, text) to browser client displayed on screens. Stack: Fastify HTTP/WebSocket + Discord.js bot + Prisma queue + Electron desktop client.

## Tech stack

- **Runtime**: Node.js + TypeScript (`tsx` dev, `dist/` prod)
- **HTTP framework**: Fastify v4 + CORS + Socket.IO (`fastify-socket.io`)
- **Discord**: discord.js v14 (slash commands, interaction handlers)
- **Database**: Prisma v5 + SQLite — models: `Queue`, `Guild`
- **i18n**: custom `rosetty` (FR/EN under `src/services/i18n/`)
- **TTS**: Google TTS via `gtts`
- **Video player**: vidstack (client-side, `src/components/client/`)
- **Desktop client**: Electron (`desktop-client/`)
- **Package manager**: `pnpm`

## Key source layout

```
src/
  index.ts              — entry point, starts Fastify
  server.ts             — registers plugins, loaders, routes
  loaders/
    DiscordLoader.ts    — bot setup, slash command registration & handler
    RESTLoader.ts       — mounts REST route plugins
    socketLoader.ts     — Socket.IO event handlers
  components/
    discord/            — per-command files (setup, announce, alive, info, …)
    messages/           — send/talk/stop/hide commands + messagesWorker
    client/             — browser player HTML/JS/CSS (vidstack)
    api/statsRoutes.ts  — GET /api/stats (requires auth session)
    dashboard/          — dashboardRoutes.ts — glassmorphism admin dashboard + Discord OAuth
  services/
    env.ts              — zod-validated env vars (T3 env-core)
    session.ts          — session token management
    cpuSampler.ts       — background CPU/RAM sampling for dashboard
    prisma/loadPrisma.ts
    i18n/               — loader.ts + en.ts + fr.ts
    content-utils.ts, discord-utils.ts, utils.ts, gtts.ts
  types/module.d.ts     — global augmentations (FastifyCustomInstance, logger, prisma, etc.)
prisma/
  migrations/           — SQLite schema (Queue + Guild tables)
desktop-client/         — Electron wrapper
```

## Dev commands

```bash
pnpm dev         # run migrations then start with tsx + pino-pretty
pnpm lint        # eslint --fix
pnpm migration:up   # prisma db push
pnpm migration:make # prisma migrate dev
```

## Globals

`server.ts` attaches to `global`: `logger`, `prisma`, `discordClient`, `discordRest`, `rosetty`, `commandsLoaded`, `env`. Typed in `src/types/module.d.ts`.

## Dashboard auth

Discord OAuth2 flow (`/dashboard` → `/auth/callback` → cookie session). Only `env.DISCORD_OWNER_ID` allowed. Session = signed cookie (`session=…`).

## Queue flow

Discord command → `messagesWorker` dequeues → Socket.IO emit → browser client plays via vidstack.

---

**PROJECT MEMORY**: Always read `AI_STATE.md` first. Before closing or on request, update `AI_STATE.md` with current architecture and next steps.

---

## 🚀 Desktop client release

- **Trigger**: When user says "send a new version" (or similar) — **ask first** what text to show users in the update modal (release notes) before doing anything.
- Chosen text = git tag annotation message (`-m`), shown verbatim in the app update modal via `electron-updater`.
- The CI (`.github/workflows/desktop-release.yml`) reads the tag annotation and creates the GitHub Release automatically — **no `gh release create` needed manually**.

### Release commands

```bash
# 1. Bump version in desktop-client/package.json, commit & push
# 2. Create annotated tag with release notes and push — CI does the rest

# Stable release (auto-updates all users)
npm run tag -- v1.2.11 -m "Your message here — visible in the update modal"
git push origin v1.2.11

# Pre-release / RC (does NOT auto-update stable users)
npm run tag -- v1.2.11-rc.1 -m "Test version — experimental features"
git push origin v1.2.11-rc.1
```

- Tag pattern `vX.X.X` → stable GitHub Release
- Tag pattern `vX.X.X-rc.N` → pre-release (electron-updater skips auto-update for stable users)
- `npm run tag` is defined in `desktop-client/package.json` as an alias for `git tag -a`

## 🧠 Memory & Context

- **Mandatory read**: If user says "let's resume" or "where are we?" — read `AI_STATE.md` first.
- **Commit ritual** — strict order:
  1. Analyze changes made.
  2. Update `AI_STATE.md` (current architecture, done, remaining).
  3. Stage `AI_STATE.md` (`git add AI_STATE.md`).
  4. Generate commit with appropriate message.

## 🔒 Security

- **Zero secrets**: Never hardcode API keys, passwords, tokens, or sensitive data in code or `AI_STATE.md`. Always use `.env`.

## 🧹 Code quality

- **No dead code**: Remove unused imports, uncalled variables, obsolete functions, debug logs immediately.
- **Modern syntax**: Use latest language/framework features detected in project.
- **SonarLint/SonarQube compliance**: Low cognitive complexity, explicit error handling, strict typing.

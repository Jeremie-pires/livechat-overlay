# LiveChat CCB — CLAUDE.md

## Project overview

**LiveChat CCB** is a Discord bot that streams media (images, videos, audio, links, text) to a browser-based client displayed on screens. It combines a Fastify HTTP/WebSocket server, a Discord.js bot, a Prisma-managed queue, and an Electron desktop client.

## Tech stack

- **Runtime**: Node.js with TypeScript (`tsx` for dev, compiled to `dist/` for prod)
- **HTTP framework**: Fastify v4 + CORS + Socket.IO (`fastify-socket.io`)
- **Discord**: discord.js v14 (slash commands, interaction handlers)
- **Database**: Prisma v5 with SQLite — two models: `Queue` and `Guild`
- **i18n**: custom `rosetty` setup (FR/EN under `src/services/i18n/`)
- **TTS**: Google TTS via `gtts`
- **Video player**: vidstack (client-side, bundled assets in `src/components/client/`)
- **Desktop client**: Electron app under `desktop-client/`
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
    dashboard/          — dashboardRoutes.ts — full glassmorphism admin dashboard + Discord OAuth
  services/
    env.ts              — zod-validated env vars (T3 env-core)
    session.ts          — simple session token management
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

`server.ts` attaches helpers to `global`: `logger`, `prisma`, `discordClient`, `discordRest`, `rosetty`, `commandsLoaded`, `env`. These are typed in `src/types/module.d.ts`.

## Dashboard auth

Discord OAuth2 flow (`/dashboard` → `/auth/callback` → cookie session). Only `env.DISCORD_OWNER_ID` is allowed in. Session stored as a signed cookie (`session=…`).

## Queue flow

Discord command → `messagesWorker` dequeues → emits via Socket.IO to the browser client → client plays content with vidstack.

---

**MEMOIRE DU PROJET** : Commence toujours par lire `AI_STATE.md`. Avant de fermer le terminal ou sur demande, mets à jour `AI_STATE.md` avec l'état actuel de l'architecture et les prochaines étapes.

---

## 🧠 Mémoire et Contexte

- **Lecture obligatoire :** Si je te demande "On reprend" ou "Où en est-on ?", commence par lire `AI_STATE.md` pour récupérer le contexte.
- **Le rituel du Commit :** À chaque fois que je te demande de faire un commit (ou de préparer un message de commit), tu dois **strictement suivre cet ordre** :
  1. Analyser les changements effectués.
  2. Mettre à jour le fichier `AI_STATE.md` (architecture actuelle, ce qui vient d'être fait, ce qu'il reste à faire).
  3. Ajouter `AI_STATE.md` aux fichiers stagés (`git add AI_STATE.md`).
  4. Générer le commit avec le message approprié.

## 🔒 Sécurité

- **Zéro Secret :** Il est strictement interdit d'écrire des clés d'API, des mots de passe, des tokens ou des données sensibles dans le code en dur, et encore moins dans `AI_STATE.md`. Utilise toujours le `.env`.

## 🧹 Qualité du Code et Standards

- **Clean Code strict :** Ne laisse aucun code mort. Supprime immédiatement les imports inutilisés, les variables non appelées, les fonctions obsolètes et les logs de debug.
- **Modernité :** Utilise les syntaxes et les features les plus récentes du langage ou du framework détecté dans ce projet.
- **Conformité SonarLint/SonarQube :** Écris le code pour qu'il passe les analyses statiques haut la main. Limite la complexité cognitive (découpe tes fonctions), gère explicitement toutes les exceptions/cas d'erreur, et type strictement tes données.

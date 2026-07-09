# AI_STATE.md — LiveChat CCB

## Statut
Stable. Système de logging BDD + DMs owner + nettoyage dead code déployé.

## Architecture actuelle

### Entrée / Serveur
- `src/index.ts` — point d'entrée Fastify + handlers `uncaughtException` / `unhandledRejection` (crash capturé → log BDD + DM owner → exit 1)
- `src/server.ts` — enregistrement des plugins, loaders, routes
- **Globals** : `logger`, `prisma`, `discordClient`, `discordRest`, `rosetty`, `commandsLoaded`, `env`

### Loaders
- `src/loaders/DiscordLoader.ts` — bot Discord, dispatch commands, log START au ClientReady, log STOP + DM owner au SIGTERM/SIGINT
- `src/loaders/RESTLoader.ts` — routes REST
- `src/loaders/socketLoader.ts` — événements Socket.IO

### Composants
- `src/components/discord/` — commandes slash : dispo, client, setup, help, info, config-defaut, config-max, announce
- `src/components/messages/` — send/cmsg/dire/cdire/stop + messagesWorker
- `src/components/client/` — player navigateur HTML/JS/CSS (vidstack)
- `src/components/api/statsRoutes.ts` — GET /api/stats (auth requise) — inclut les BotEvents
- `src/components/dashboard/dashboardRoutes.ts` — dashboard glassmorphism + OAuth Discord + onglet Journal

### Services
- `src/services/env.ts` — variables d'env validées par Zod
- `src/services/session.ts` — tokens de session (cookie signé)
- `src/services/cpuSampler.ts` — échantillonnage CPU/RAM
- `src/services/botLogger.ts` — `logBotEvent(type, message)` + `notifyOwner(type, message)` (DM Discord owner)
- `src/services/prisma/loadPrisma.ts` — initialisation Prisma
- `src/services/i18n/` — loader + FR/EN
- `src/services/utils.ts` — `getDurationFromGuildId` uniquement

### Base de données (Prisma v5 + SQLite)
- `Queue` — file d'attente des médias
- `Guild` — config par serveur (channel, durées, busyUntil)
- `Stats` — compteurs globaux (singleton)
- `LatencySample` — historique latence (50 derniers)
- `BotEvent` — journal démarrages/arrêts/crashs/erreurs (type, message, createdAt)

### Client desktop
- Electron wrapper dans `desktop-client/`

## Auth Dashboard
OAuth2 Discord → `/dashboard` → `/auth/callback` → cookie `session=…`
Seul `env.DISCORD_OWNER_ID` est autorisé.

## Flux Queue
Discord command → `messagesWorker` déqueue → Socket.IO emit → browser client (vidstack)

## Ce qui vient d'être fait
- **Crash handlers** : `uncaughtException` + `unhandledRejection` dans `index.ts` — cause probable des 5 redémarrages du 09/07/2026
- **BotEvent logging** : modèle Prisma + service `botLogger.ts` — log START/STOP/CRASH/ERROR en BDD
- **DMs owner** : `notifyOwner()` dans `botLogger.ts` — DM Discord à l'owner sur CRASH et STOP
- **Dashboard Journal** : onglet avec les 100 derniers événements, badges colorés par type
- **Fix deprecation `ephemeral`** : `flags: MessageFlags.Ephemeral` dans les 11 fichiers concernés
- **Fix deprecation `reply.redirect()`** : nouvelle signature Fastify v4 dans `dashboardRoutes.ts`
- **Suppression `/config-displayfull`** : dead code retiré entièrement (commande, fonction, refs)
- **README** : liste des commandes mise à jour
- **Docker TZ** : `TZ: Europe/Paris` dans `docker-compose.yml`
- **Git** : `!CLAUDE.md` + `!AI_STATE.md` forcés dans `.gitignore`

## Points ouverts
- 404 réguliers en paires dans les logs (origine inconnue — tcpdump n'a rien retourné, probablement trafic TLS terminé en amont par HAProxy). À surveiller via l'onglet Journal du dashboard après déploiement.
- Migration Prisma (`BotEvent`) : sera appliquée automatiquement au démarrage via `pnpm migration:up` (`prisma db push`).

## Prochaines étapes
En attente d'instructions.

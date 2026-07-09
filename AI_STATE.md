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
- `src/components/discord/` — commandes slash : dispo, client, setup, help, info, config-defaut, config-max, announce, maintenance
- `src/components/messages/` — send/cmsg/dire/cdire/stop + messagesWorker
- `src/components/client/` — player navigateur HTML/JS/CSS (vidstack)
- `src/components/api/statsRoutes.ts` — GET /api/stats (auth requise) — inclut les BotEvents
- `src/components/dashboard/dashboardRoutes.ts` — dashboard glassmorphism + OAuth Discord + onglet Journal

### Services
- `src/services/env.ts` — variables d'env validées par Zod
- `src/services/session.ts` — tokens de session (cookie signé)
- `src/services/cpuSampler.ts` — échantillonnage CPU/RAM
- `src/services/botLogger.ts` — `logBotEvent(type, message)` + `notifyOwner(type, message)` (DM Discord owner)
- `src/services/broadcast.ts` — `broadcastToAllGuilds(title, description, color)` partagée entre DiscordLoader, maintenanceCommand et dashboardRoutes
- `src/services/prisma/loadPrisma.ts` — initialisation Prisma
- `src/services/i18n/` — loader + FR/EN
- `src/services/utils.ts` — `getDurationFromGuildId` uniquement

### Base de données (Prisma v5 + SQLite)
- `Queue` — file d'attente des médias
- `Guild` — config par serveur (channel, durées, busyUntil)
- `Stats` — compteurs globaux (singleton)
- `LatencySample` — historique latence (50 derniers)
- `BotEvent` — journal démarrages/arrêts/crashs/erreurs (type, message, createdAt)
- `Stats.silentMode` — booléen global (singleton) pour couper les annonces de redémarrage

### Client desktop
- Electron wrapper dans `desktop-client/`

## Auth Dashboard
OAuth2 Discord → `/dashboard` → `/auth/callback` → cookie `session=…`
Seul `env.DISCORD_OWNER_ID` est autorisé.

## Flux Queue
Discord command → `messagesWorker` déqueue → Socket.IO emit → browser client (vidstack)

## Ce qui vient d'être fait (dernière session)
- **Lancer au démarrage de Windows** : `launchAtStartup: boolean` ajouté à `AppSettings` dans `main.ts` et `preload.ts`. `app.setLoginItemSettings({ openAtLogin })` appelé au démarrage (`bootstrap`) et à chaque sauvegarde (`app:save-settings`). Checkbox "Lancer au démarrage de Windows" ajoutée dans l'onglet Serveur (`index.html`). `renderer.js` mis à jour : `elements`, `readFormValues`, `refreshUi`, `onSettingsChanged`.

## Historique
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
- **Fix "Missing Access" unhandledRejection** : `GuildCreate` handler dans `DiscordLoader.ts` — `channel.send()` désormais attendu (async) et entouré d'un try/catch. Sans ça, si le bot n'a pas la permission d'écrire dans le channel trouvé, la rejection n'était pas capturée → crash.
- **Fix spam d'annonces sur crash** : `ClientReady` dans `DiscordLoader.ts` — `broadcastToAllGuilds` n'est désormais appelé que si le dernier `BotEvent` enregistré est de type `STOP` (arrêt propre) ou s'il n'y a aucun event précédent (premier boot). En cas de crash, le bot redémarre silencieusement sans spammer les serveurs.
- **Résilience messagesWorker** : `loadMessagesWorker` dans `messagesWorker.ts` — `executeMessagesWorker` entouré d'un try/catch pour ne pas propager d'erreurs inattendues (ex : Prisma timeout, JSON malformé) en unhandledRejection.
- **Mode maintenance** : `Stats.silentMode` (Prisma) — commande `/maintenance on|off` (owner-only) + bouton toggle dans le dashboard. Quand actif : aucune annonce de redémarrage même en boucle. Quand désactivé depuis la commande/dashboard : broadcast immédiat "🟢 En ligne !" + logic last-event reprise.

## Points ouverts
- 404 réguliers en paires dans les logs (origine inconnue — tcpdump n'a rien retourné, probablement trafic TLS terminé en amont par HAProxy). À surveiller via l'onglet Journal du dashboard après déploiement.
- Migration Prisma (`BotEvent`) : sera appliquée automatiquement au démarrage via `pnpm migration:up` (`prisma db push`).

## Prochaines étapes
En attente d'instructions.

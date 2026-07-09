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
- `src/loaders/socketLoader.ts` — événements Socket.IO — lors du `join-room` avec token, fetch l'avatar Discord du user (cache first puis `users.fetch`) et le stocke dans le presenceStore

### Composants
- `src/components/discord/` — commandes slash : dispo, client, setup, help, info, config-defaut, config-max, announce, maintenance
- `src/components/messages/` — send/cmsg/dire/cdire/stop + messagesWorker
- `src/components/client/` — player navigateur HTML/JS/CSS (vidstack)
- `src/components/api/statsRoutes.ts` — GET /api/stats (auth requise) — inclut BotEvents + champ `isSetup` par guild (lookup Prisma via `Set<string>`)
- `src/components/dashboard/dashboardRoutes.ts` — dashboard glassmorphism + OAuth Discord + onglet Journal + badge setup par serveur + subtitle "X connectés / Y configurés" + cards restructurées (server-top / server-badges)

### Services
- `src/services/env.ts` — variables d'env validées par Zod
- `src/services/session.ts` — tokens de session (cookie signé)
- `src/services/cpuSampler.ts` — échantillonnage CPU/RAM
- `src/services/botLogger.ts` — `logBotEvent(type, message)` + `notifyOwner(type, message)` (DM Discord owner)
- `src/services/broadcast.ts` — `broadcastToAllGuilds(title, description, color)` partagée entre DiscordLoader, maintenanceCommand et dashboardRoutes
- `src/services/presenceStore.ts` — `PresenceEntry { displayName, connectedAt, avatarUrl }` — avatarUrl ajouté
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
- `ClientSession` — tokenHash (SHA-256) + discordUserId + displayName + guildId

### Client desktop (v1.2.1)
- Electron wrapper dans `desktop-client/`
- Trois onglets : Contrôle / Serveur / Utilisateurs
- Onglet "Utilisateurs" : liste verticale des clients connectés avec avatar Discord (ou initiale), pseudo, durée de connexion
- `input[type="password"]` (token) stylisé identiquement aux autres inputs
- Polling présence toutes les 15 s alimente aussi la liste de l'onglet Utilisateurs

## Auth Dashboard
OAuth2 Discord → `/dashboard` → `/auth/callback` → cookie `session=…`
Seul `env.DISCORD_OWNER_ID` est autorisé.

## Flux Queue
Discord command → `messagesWorker` déqueue → Socket.IO emit → browser client (vidstack)

## Ce qui vient d'être fait (dernière session)
- **Release v1.2.1** : CSS `input[type="password"]` uniformisé avec les autres inputs ; onglet "Utilisateurs" dans l'app desktop (liste avatar + pseudo + durée) ; `presenceStore` étendu avec `avatarUrl` ; socketLoader fetch l'avatar Discord au join-room.
- **Dashboard refacto** : subtitle "X serveurs connectés / Y configurés" ; server-cards restructurées en colonne (server-top: avatar+nom/membres | server-badges: setupBadge+presenceBadge).
- **Badge isSetup sur les serveurs** : `statsRoutes.ts` — `isSetup: boolean` par guild. Dashboard — badge `Configuré` / `Non configuré`.
- **Démarrer minimisé** : `startMinimized: boolean` dans settings, `show: false` + `ready-to-show` dans createControlWindow.
- **infoCommand.ts** : ajout lien site LiveChat, renommage lien site perso.
- **Système de présence (Rooms)** : `ClientSession` (Prisma), token SHA-256, safeStorage Electron, `presenceStore.ts`.

## Historique
- **Crash handlers** : `uncaughtException` + `unhandledRejection` dans `index.ts`
- **BotEvent logging** : modèle Prisma + service `botLogger.ts`
- **DMs owner** : `notifyOwner()` dans `botLogger.ts`
- **Dashboard Journal** : onglet avec les 100 derniers événements
- **Fix deprecation `ephemeral`** : `flags: MessageFlags.Ephemeral`
- **Fix deprecation `reply.redirect()`** : Fastify v4
- **Suppression `/config-displayfull`** : dead code retiré
- **Docker TZ** : `TZ: Europe/Paris`
- **Fix "Missing Access" unhandledRejection** : `GuildCreate` handler async + try/catch
- **Fix spam d'annonces sur crash** : broadcast conditionnel (STOP uniquement)
- **Résilience messagesWorker** : try/catch dans executeMessagesWorker
- **Mode maintenance** : `Stats.silentMode` + commande `/maintenance` + bouton dashboard

## Points ouverts
- 404 réguliers en paires dans les logs (origine inconnue — probablement trafic TLS terminé en amont par HAProxy). À surveiller via le Journal du dashboard.
- Déploiement serveur en attente : `git pull && docker compose down && docker compose up -d --build` (nécessaire pour presenceStore avatarUrl + dashboard refacto + badge isSetup).

## Prochaines étapes
En attente d'instructions.

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
- `src/services/presenceStore.ts` — `PresenceEntry { displayName, connectedAt, avatarUrl }` — déduplique par `discordUserId` via `userSocketMap`
- `src/services/presenceSse.ts` — SSE broadcaster : `register(res)` + `push(presence)` → notifie le dashboard en temps réel
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

### Client desktop (v1.2.1 → v1.3.0-next)
- Electron wrapper dans `desktop-client/`
- Trois onglets : Contrôle / Serveur / Utilisateurs
- Onglet "Utilisateurs" : liste verticale des clients connectés avec avatar Discord (ou initiale), pseudo, durée de connexion
- **Tray** : l'app démarre dans le tray (si `startMinimized` activé), fermer la fenêtre → tray, clic tray toggle la fenêtre, menu contextuel "Ouvrir / Quitter"
- **Présence temps réel** : `overlay-preload.ts` bridge les events `presence:update` du socket vers IPC main → control window. Polling fallback 60 s. Plus de doublons (presenceStore filtre par discordUserId).
- `extraResources` dans package.json : `build/icon.ico` copié dans `resources/icon.ico` pour le tray packagé

## Environnements Prod & Staging

| Env        | Branche | Port | Volume Docker        | Base SQLite      | Domaine                       |
|------------|---------|------|----------------------|------------------|-------------------------------|
| Production | `main`  | 3000 | `livechat_data`      | `sqlite.db`      | `livechat.ton-domaine.fr`     |
| Staging    | `develop`| 3001| `livechat_dev_data`  | `sqlite-dev.db`  | `dev-livechat.ton-domaine.fr` |

- **`docker-compose.yml`** — prod, lit `.env`
- **`docker-compose.dev.yml`** — staging, lit `.env.dev`, port 3001, volume séparé
- **`haproxy.cfg.example`** — routage ACL par sous-domaine (prod → 3000, staging → 3001)
- **`STAGING_SETUP.md`** — guide complet de mise en place (bot Discord dev, DNS, certificats SSL, HAProxy, workflow Git)
- Lancement staging : `docker compose -f docker-compose.dev.yml up -d --build`
- Chaque env a son propre bot Discord pour éviter les conflits de commandes slash

## Auth Dashboard
OAuth2 Discord → `/dashboard` → `/auth/callback` → cookie `session=…`
Seul `env.DISCORD_OWNER_ID` est autorisé.

## Flux Queue
Discord command → `messagesWorker` déqueue → Socket.IO emit → browser client (vidstack)

## Ce qui vient d'être fait (dernière session)
- **Fix DiscordAPIError 10062 (Unknown interaction)** : `sendCommand`, `hidesendCommand`, `talkCommand` — ajout de `deferReply()` en début de handler + remplacement de `interaction.reply()` par `interaction.editReply()`. Corrige les timeouts Discord (3s) sur les serveurs lents ou avec URL lentes à résoudre. Import `MessageFlags` retiré de `hidesendCommand` (devenu inutilisé).
- **Dashboard — renommage métrique "latence"** : "Latence moy." → "Attente file moy." dans les 3 endroits du dashboard. La métrique mesure le temps d'attente en file d'attente (submissionDate → émission Socket.IO), pas la latence réseau réelle (~1.2s fixe via `MESSAGE_SYNC_LEAD_TIME_MS`).

## Historique
- **Fix YouTube Shorts / portrait** : `content-utils.ts` — `isYouTubeShortUrl()` + détection portrait via `loaded-metadata` côté client.
- **Tray (desktop)** : `startMinimized` → "Démarrer dans le tray" ; fenêtre cachée au lieu de quittée sur close ; tray avec menu "Ouvrir / Quitter" ; `isQuitting` flag ; `extraResources` pour l'icône packagée.
- **Déduplication présence** : `presenceStore` trackle `discordUserId` via `userSocketMap`.
- **Présence dynamique (desktop)** : `overlay-preload.ts` bridge les events `presence:update` du socket vers IPC → control window. Polling fallback 60 s.
- **Dashboard présence temps réel** : `presenceSse.ts` (SSE broadcaster) + endpoint `/api/presence-events` + `EventSource` dans le dashboard JS.
- **Release v1.2.1** : CSS `input[type="password"]`, onglet Utilisateurs desktop, presenceStore avatarUrl, socketLoader Discord avatar.
- **Badge isSetup sur les serveurs** : `statsRoutes.ts` + dashboard.
- **Système de présence (Rooms)** : `ClientSession` (Prisma), token SHA-256, safeStorage Electron, `presenceStore.ts`.
- **Crash handlers** : `uncaughtException` + `unhandledRejection` dans `index.ts`
- **BotEvent logging** : modèle Prisma + service `botLogger.ts`
- **DMs owner** : `notifyOwner()` dans `botLogger.ts`
- **Dashboard Journal** : onglet avec les 100 derniers événements
- **Fix deprecation `reply.redirect()`** : Fastify v4
- **Docker TZ** : `TZ: Europe/Paris`
- **Fix "Missing Access" unhandledRejection** : `GuildCreate` handler async + try/catch
- **Fix spam d'annonces sur crash** : broadcast conditionnel (STOP uniquement)
- **Résilience messagesWorker** : try/catch dans executeMessagesWorker
- **Mode maintenance** : `Stats.silentMode` + commande `/maintenance` + bouton dashboard

## Points ouverts
- 404 réguliers en paires dans les logs (origine inconnue — probablement trafic TLS terminé en amont par HAProxy). À surveiller via le Journal du dashboard.
- Déploiement serveur requis : `git pull && docker compose down && docker compose up -d --build` (inclut fix 10062 + presenceSse + dashboard SSE + presenceStore dedup + Shorts).
- Desktop client : bump version + release (v1.3.0) à planifier.

## Prochaines étapes
En attente d'instructions.

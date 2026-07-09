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
- `src/components/api/statsRoutes.ts` — GET /api/stats (auth requise) — inclut BotEvents + champ `isSetup` par guild (lookup Prisma via `Set<string>`)
- `src/components/dashboard/dashboardRoutes.ts` — dashboard glassmorphism + OAuth Discord + onglet Journal + badge setup par serveur

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
- **Badge isSetup sur les serveurs** : `statsRoutes.ts` — ajout de `prisma.guild.findMany({ select: { id: true } })` dans le `Promise.all` existant, construction d'un `Set<string>` des IDs configurés, champ `isSetup: boolean` ajouté à chaque guild dans la réponse. Dashboard `renderServers()` — badge `<span class="badge green">Configuré</span>` ou `<span class="badge yellow">Non configuré</span>` affiché sous le nombre de membres dans chaque server-card. Réutilise les classes `.badge.green` / `.badge.yellow` déjà présentes dans le CSS du dashboard.
- **Démarrer minimisé** : `startMinimized: boolean` ajouté à `AppSettings` dans `main.ts` et `preload.ts` (défaut `false`). `normalizeSettings` mis à jour. `createControlWindow` passe désormais `show: false` (élimine le flash blanc) + handler `ready-to-show` : si `startMinimized`, `showInactive()` puis `minimize()` (fenêtre visible en barre des tâches sans prise de focus) ; sinon `show()` normal. Checkbox "Démarrer minimisé" ajoutée dans l'onglet Serveur (`index.html`). `renderer.js` mis à jour : `elements`, `readFormValues`, `refreshUi`, `onSettingsChanged`.
- **infoCommand.ts** : ajout lien site LiveChat, renommage lien site perso.
- **Système de présence (Rooms) — sécurité renforcée** : `ClientSession` (Prisma) stocke `tokenHash String @id` (SHA-256 du token en clair, jamais le token lui-même) + `@@unique([discordUserId, guildId])`. `/client` Discord génère un UUID via `randomUUID()`, le hache avec `createHash('sha256')`, insère via `$transaction([deleteMany, create])` — le token en clair est affiché une seule fois dans un embed éphémère. `socketLoader.ts` et `dashboardRoutes.ts` hachent le token reçu avant le lookup Prisma (`findUnique({ where: { tokenHash } })`). Electron `safeStorage` : le token est chiffré avec l'API OS (DPAPI Windows / Keychain macOS) avant écriture dans `settings.json` (préfixe `enc1:`) et déchiffré au chargement ; fallback gracieux en clair si `isEncryptionAvailable()` retourne false. Input `type="password"` dans l'UI pour masquage visuel. `presenceStore.ts` (RAM) : `Map<guildId, Map<socketId, {displayName, connectedAt}>>`. Dashboard : badge de présence par serveur, route `/api/presence/:guildId` auth par session ou tokenHash. Desktop : summary grid 2×2 avec "Connectés", polling 15 s.

## Historique
- **Démarrer minimisé** : voir "Ce qui vient d'être fait"
- **Lancer au démarrage de Windows** : `launchAtStartup: boolean` ajouté à `AppSettings` dans `main.ts` et `preload.ts`. `app.setLoginItemSettings({ openAtLogin })` appelé au démarrage (`bootstrap`) et à chaque sauvegarde (`app:save-settings`). Checkbox "Lancer au démarrage de Windows" ajoutée dans l'onglet Serveur (`index.html`). `renderer.js` mis à jour : `elements`, `readFormValues`, `refreshUi`, `onSettingsChanged`.
- **Release notes dans le modal de mise à jour** : `normalizeReleaseNotes()` ajouté dans `main.ts` pour normaliser `string | ReleaseNoteInfo[] | null` en texte brut. Payload `update:downloaded` étendu avec `releaseNotes: string`. Type `preload.ts` mis à jour. Bannière `updateBanner` remplacée par un modal (`updateModal`) avec zone scrollable pour les notes, bouton "Plus tard" (dismiss) et bouton "Redémarrer maintenant". `stripHtml()` utilisé côté renderer pour nettoyer les notes HTML venant de GitHub. Styles de la bannière morte supprimés, styles du modal ajoutés dans `styles.css`.

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

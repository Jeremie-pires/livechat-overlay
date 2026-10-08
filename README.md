# LiveChat CCB Desktop

Envoie du contenu (vidéos, images, audio, texte) sur ton écran en direct depuis Discord, affiché en overlay dans une fenêtre non clicable qui n'interfere pas avec ton écran.

> Basé sur le travail original de [Quentin Laffont] [repo d'origine](https://github.com/qlaffont/LiveChatCaCaBox)

---

## Comment ça marche

Un bot Discord écoute les commandes sur ton serveur. Quand tu envoies un contenu, l'app desktop Windows permet d'afficher cet overlay directement par-dessus ton jeu, sans capturer la souris.

Ce code source est public pour garantir sa sécurité, son intégrité et partager son utilisation pour des forks potentiels. Pour tout fork ou réutilisation, n'hésitez pas à me crediter dessus.

---

## Utilisation

### 1. Inviter le bot

[👉 Inviter le bot sur ton serveur Discord](https://www.livechatccb.online/)

### 2. Configurer le canal

Sur ton serveur, dans le canal où tu veux que le bot écoute les commandes, tape :

```
/setup #ton-canal
```

Seul un **administrateur** du serveur peut faire cette commande.

### 3. Récupérer l'URL et ton token

```
/client
```

Le bot te répond en privé (message éphémère) avec :
- **L'URL du backend** à coller dans l'app
- **L'ID de ta Guild Discord**
- **Ton token client** — un identifiant unique qui permet à l'app d'apparaître dans la liste des clients connectés

> Le token est régénéré à chaque `/client`. Si tu en génères un nouveau, mets à jour l'app.

### 4. App desktop (overlay Windows)

L'app desktop affiche le livechat directement par-dessus ton jeu en borderless, sans passer par OBS.

[⬇️ Télécharger LiveChatCCB Desktop](https://github.com/Jeremie-pires/livechat-overlay/releases/latest)

Si une popup Windows s'ouvre, il faut faire **Informations complémentaires** et **Exécuter quand même**.

Dans l'onglet **Serveur** de l'app :
- **URL du backend** : l'URL fournie par `/client`
- **ID de la Guild Discord** : l'ID fourni par `/client`
- **Token client** : le token fourni par `/client` — colle-le dans ce champ pour apparaître dans la liste des connectés. Il est chiffré localement par Windows avant d'être sauvegardé.

### A propos du bot hébergé

Le bot est hébergé par mes soins pour en faire profiter le plus de monde possible, des bugs peuvent se produire, si c'est le cas n'hésitez pas à me contacter.
L'objectif est d'en faire un projet communautaire qui évolue, je prends en compte les requêtes et idées de tous.

### Commandes disponibles

| Commande | Description |
|---|---|
| `/dispo` | Vérifie si le bot répond |
| `/client` | Donne l'URL, l'ID de la guild et ton token client (éphémère) |
| `/setup` | Setup le channel dans lequel le bot va écouter |
| `/msg` | Envoie un contenu sur le livechat (lien, image, texte) |
| `/cmsg` | Même chose, mais discret (pas de confirmation visible) |
| `/dire` | Fait lire un texte par une voix de synthèse |
| `/cdire` | Même chose, mais discret |
| `/stop` | Interrompt le contenu en cours |
| `/config-defaut` | Défini le temps par défaut d'un média |
| `/config-max` | Défini le temps maximum d'un média |
| `/help` | Liste toutes les commandes |
| `/info` | Donne des infos sur le bot et son créateur |

---

## Auto-hébergement et développement

Cette section s'adresse aux personnes qui veulent faire tourner leur propre instance (bot Discord séparé, backend perso).

### Prérequis

- [Docker](https://www.docker.com/get-started/) (recommandé)
- Ou [Node 20](https://nodejs.org/en) + [pnpm](https://pnpm.io/fr/installation) + [ffmpeg](https://ffmpeg.org/)

### Créer son bot Discord

1. Créer une application sur [discord.com/developers](https://discord.com/developers/applications?new_application=true)
2. Définir un nom (ce sera le nom affiché du bot)
3. Copier l'**Application ID** → `DISCORD_CLIENT_ID`
4. Dans la sidebar : **Bot** → **Reset Token** → copier le token → `DISCORD_TOKEN`
5. Activer le bot en mode public si tu veux que d'autres serveurs puissent l'inviter
6. Au démarrage, le backend affiche dans les logs le lien d'invitation

### Lancer avec Docker

Le projet inclut un `docker-compose.yml` prêt à l'emploi avec le backend CCB et un service [Cobalt](https://github.com/imputnet/cobalt) pour l'extraction vidéo TikTok/Twitter.

```bash
cp .env.example .env
# Remplir le .env avec tes valeurs
docker compose up -d --build
```

Le service Cobalt démarre automatiquement sur le port 9000. Si tu n'as pas besoin de l'extraction vidéo TikTok/Twitter, tu peux omettre les variables `COBALT_*` — l'app se rabattra sur l'affichage iframe.

### Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `API_URL` | ✅ | URL publique du backend (ex: `https://livechat.ton-domaine.fr`) |
| `DISCORD_TOKEN` | ✅ | Token du bot Discord |
| `DISCORD_CLIENT_ID` | ✅ | ID de l'application Discord |
| `DISCORD_CLIENT_SECRET` | ✅ | Secret OAuth2 de l'application Discord (pour le dashboard) |
| `DISCORD_OWNER_ID` | ✅ | Ton ID Discord — permet d'utiliser `/announce`, le dashboard et les DMs de crash |
| `DATABASE_URL` | ✅ | URL SQLite (ex: `file:/data/sqlite.db`) |
| `APP_ENV` | — | `production` / `staging` / `development` (défaut: `development`) |
| `DEFAULT_DURATION` | — | Durée d'affichage par défaut en secondes (défaut: `5`) |
| `HIDE_COMMANDS_DISABLED` | — | Désactiver `/cmsg` et `/cdire` (`true`/`false`, défaut: `false`) |
| `COBALT_API_URL` | — | URL interne du service Cobalt (ex: `http://cobalt:9000` en Docker). Laisser vide pour désactiver. |
| `COBALT_PUBLIC_URL` | — | URL publique de Cobalt accessible depuis le navigateur (identique à `COBALT_API_URL` si le port est exposé) |
| `YTDLP_COOKIES` | — | Chemin vers le fichier `cookies.txt` (format Netscape) pour yt-dlp. Monté depuis `./cobalt-cookies/` en Docker. |
| `YTDLP_PATH` | — | Chemin vers l'exécutable `yt-dlp` (défaut: `yt-dlp`) |
| `FFPROBE_PATH` | — | Chemin vers `ffprobe` (défaut: `ffprobe`) |

### Extraction vidéo TikTok et Twitter/X

Par défaut, les liens TikTok et Twitter/X s'affichent en iframe. Pour extraire le flux vidéo directement (meilleure qualité, contrôle de durée, proxy Range-aware), deux mécanismes sont disponibles.

#### Twitter/X — Cobalt

Le service [Cobalt](https://github.com/imputnet/cobalt) est intégré au `docker-compose.yml`. Il suffit de renseigner `COBALT_API_URL` et `COBALT_PUBLIC_URL` dans ton `.env`.

#### TikTok — yt-dlp + cookies

TikTok exige un cookie CDN (`tt_chain_token`) pour accéder aux flux vidéo. Sans ce cookie, yt-dlp obtient l'URL mais le CDN retourne 403 à la lecture.

**Comment obtenir les cookies :**

1. Installe l'extension [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) (ou équivalent)
2. Connecte-toi sur [tiktok.com](https://www.tiktok.com) dans ton navigateur
3. Exporte les cookies en **format Netscape** (`cookies.txt`)
4. Dépose le fichier dans le dossier `cobalt-cookies/` à la racine du projet :
   ```
   cobalt-cookies/cookies.txt
   ```

Ce dossier est monté en volume dans les deux services Docker (`livechatccb` et `cobalt`). La variable `YTDLP_COOKIES` pointe vers ce fichier (valeur par défaut en Docker : `/cookies/cookies.txt`).

> Les cookies TikTok expirent. Si les vidéos TikTok retombent en iframe, renouvelle le fichier `cookies.txt`.

---

### Démarrage automatique (Linux / systemd)

Voir [livechat-overlay.service.example](livechat-overlay.service.example) pour un exemple de service systemd.

### Reverse proxy HTTPS (HAProxy)

Voir [`docs/infra/haproxy.cfg.example`](docs/infra/haproxy.cfg.example) pour un exemple de configuration HAProxy avec terminaison TLS et routage prod/staging.

> **Healthcheck HAProxy** : utilise `/health` (liveness — répond toujours 200 tant que le serveur HTTP tourne). N'utilise **pas** `/health/ready` pour la probe HAProxy : cet endpoint vérifie aussi la DB et le bot Discord — un redémarrage Discord marquerait le backend DOWN malgré un serveur HTTP opérationnel. Réserve `/health/ready` au monitoring/alerting externe.

### Développement local

```bash
cp .env.example .env
pnpm install
pnpm dev
```

### App desktop — build

```bash
cd desktop-client
npm install
npm run dist   # génère le .exe dans release/
```

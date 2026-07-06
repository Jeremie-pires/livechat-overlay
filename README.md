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

[👉 Inviter le bot sur ton serveur Discord](#) *(lien à venir)*

### 2. Configurer le canal

Sur ton serveur, dans le canal où tu veux que le bot écoute les commandes, tape :

```
/setup #ton-canal
```

Seul un **administrateur** du serveur peut faire cette commande.

### 3. Récupérer l'URL

```
/client
```

Le bot te donne l'URL à coller dans l'app côté serveur et l'ID de ton serveur Discord.

### 4. App desktop (overlay Windows)

L'app desktop affiche le livechat directement par-dessus ton jeu en borderless, sans passer par OBS.

[⬇️ Télécharger LiveChatCCB Desktop](#) *(lien à venir)*

Dans l'onglet **Serveur** de l'app :
- **URL du backend** : l'URL fournie par `/client`
- **ID de la Guild Discord** : l'ID fourni par `/client`

### Commandes disponibles

| Commande | Description |
|---|---|
| `/dispo` | Vérifie si le bot répond |
| `/client` | Donne l'URL OBS et l'ID de la guild |
| `/msg` | Envoie un contenu sur le stream (lien, image, texte) |
| `/cmsg` | Même chose, mais discret (pas de confirmation visible) |
| `/dire` | Fait lire un texte par une voix de synthèse |
| `/cdire` | Même chose, mais discret |
| `/stop` | Interrompt le contenu en cours |
| `/help` | Liste toutes les commandes |

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

```yaml
# docker-compose.yml
services:
  livechatccb:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: file:/data/sqlite.db
      DISCORD_TOKEN: ${DISCORD_TOKEN}
      DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}
      DISCORD_OWNER_ID: ${DISCORD_OWNER_ID}   # optionnel, pour /announce
      API_URL: ${API_URL}
      DEFAULT_DURATION: ${DEFAULT_DURATION:-5}
      HIDE_COMMANDS_DISABLED: ${HIDE_COMMANDS_DISABLED:-false}
    volumes:
      - livechat_data:/data

volumes:
  livechat_data:
```

```bash
cp .env.example .env
# Remplir le .env avec tes valeurs
docker compose up -d --build
```

### Variables d'environnement

| Variable | Description |
|---|---|
| `API_URL` | URL publique du backend (ex: `https://livechat.ton-domaine.fr`) |
| `DISCORD_TOKEN` | Token du bot Discord |
| `DISCORD_CLIENT_ID` | ID de l'application Discord |
| `DISCORD_OWNER_ID` | Ton ID Discord — permet d'utiliser `/announce` |
| `DEFAULT_DURATION` | Durée d'affichage par défaut en secondes (défaut: `5`) |
| `HIDE_COMMANDS_DISABLED` | Désactiver `/cmsg` et `/cdire` (`true`/`false`) |

### Démarrage automatique (Linux / systemd)

Voir [livechat-overlay.service.example](livechat-overlay.service.example) pour un exemple de service systemd.

### Reverse proxy HTTPS (HAProxy)

Voir [haproxy.cfg.example](haproxy.cfg.example) pour un exemple de configuration HAProxy avec terminaison TLS.

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

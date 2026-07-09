# Guide — Environnement de Staging

Ce guide explique comment faire tourner un environnement de **staging (pré-production)** en parallèle de la production sur la même machine, sans jamais couper le bot ou l'API.

---

## Architecture cible

| Environnement | Branche Git | Port | Base de données    | Domaine exemple                  |
|---------------|-------------|------|--------------------|----------------------------------|
| Production    | `main`      | 3000 | `sqlite.db`        | `livechat.ton-domaine.fr`        |
| Staging       | `develop`   | 3001 | `sqlite-dev.db`    | `dev-livechat.ton-domaine.fr`    |

Le reverse proxy **HAProxy** route le trafic entrant vers le bon backend selon le sous-domaine.

---

## Étape 1 — Créer un bot Discord dédié au staging

Le staging doit utiliser un bot Discord **distinct** de celui de prod pour éviter les conflits de commandes slash.

1. Aller sur [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Donner un nom reconnaissable, ex. `LiveChatCCB [DEV]`
3. Copier l'**Application ID** → ce sera `DISCORD_CLIENT_ID` dans `.env.dev`
4. Sidebar **Bot** → **Reset Token** → copier → `DISCORD_TOKEN` dans `.env.dev`
5. Sidebar **OAuth2** → activer `bot` + `applications.commands` dans les scopes
6. Sidebar **Bot** → activer les **Privileged Gateway Intents** si nécessaire
7. Inviter le bot de dev sur un serveur de test via le lien généré au démarrage

---

## Étape 2 — Configurer le DNS (sous-domaine)

Ajouter un enregistrement DNS de type **A** pointant vers la même IP que le serveur de prod :

```
dev-livechat.ton-domaine.fr.  IN  A  <IP_DU_SERVEUR>
```

La propagation DNS peut prendre quelques minutes à quelques heures selon le TTL.

---

## Étape 3 — Générer le certificat SSL pour le sous-domaine

### Option A — Wildcard (recommandé si Let's Encrypt + Certbot)

```bash
certbot certonly --standalone -d "*.ton-domaine.fr" -d "ton-domaine.fr"
```

Un seul certificat couvre tous les sous-domaines. Combiner en `.pem` pour HAProxy :

```bash
cat /etc/letsencrypt/live/ton-domaine.fr/fullchain.pem \
    /etc/letsencrypt/live/ton-domaine.fr/privkey.pem \
    > /etc/haproxy/certs/wildcard.pem
```

### Option B — Certificats séparés

```bash
certbot certonly --standalone -d dev-livechat.ton-domaine.fr
cat /etc/letsencrypt/live/dev-livechat.ton-domaine.fr/fullchain.pem \
    /etc/letsencrypt/live/dev-livechat.ton-domaine.fr/privkey.pem \
    > /etc/haproxy/certs/dev-livechat.pem
```

HAProxy charge automatiquement tous les `.pem` d'un dossier si `crt /etc/haproxy/certs/` est utilisé.

---

## Étape 4 — Configurer HAProxy

Remplacer le contenu de `/etc/haproxy/haproxy.cfg` par le contenu de [`haproxy.cfg.example`](haproxy.cfg.example), en adaptant les domaines, puis recharger :

```bash
haproxy -c -f /etc/haproxy/haproxy.cfg   # vérifier la syntaxe
systemctl reload haproxy
```

---

## Étape 5 — Préparer l'environnement de staging sur le serveur

```bash
# Cloner ou aller dans le repo
cd /srv/livechat

# Créer le fichier .env.dev à partir de l'exemple
cp .env.dev.example .env.dev
nano .env.dev   # remplir DISCORD_TOKEN, DISCORD_CLIENT_ID, etc.
```

Variables à renseigner dans `.env.dev` :

| Variable               | Valeur attendue                                |
|------------------------|------------------------------------------------|
| `API_URL`              | `https://dev-livechat.ton-domaine.fr`          |
| `DISCORD_TOKEN`        | Token du bot Discord **de dev**                |
| `DISCORD_CLIENT_ID`    | Application ID du bot **de dev**               |
| `DISCORD_CLIENT_SECRET`| Secret OAuth du bot **de dev**                 |
| `DISCORD_OWNER_ID`     | Ton ID Discord (même que prod, optionnel)       |

> `DATABASE_URL` est géré directement dans `docker-compose.dev.yml` et pointe vers `sqlite-dev.db`. Ne pas l'ajouter dans `.env.dev`.

---

## Étape 6 — Lancer l'environnement de staging

```bash
# Basculer sur la branche develop
git fetch origin
git checkout develop

# Build et démarrage du conteneur de staging (n'impacte pas le conteneur prod)
docker compose -f docker-compose.dev.yml up -d --build
```

Pour vérifier que les deux conteneurs tournent :

```bash
docker ps
# livechatccb       0.0.0.0:3000->3000/tcp   ← Prod
# livechatccb-dev   0.0.0.0:3001->3000/tcp   ← Staging
```

---

## Workflow quotidien

### Déployer une mise à jour en staging

```bash
git checkout develop
git pull origin develop
docker compose -f docker-compose.dev.yml up -d --build
```

### Promouvoir le staging en production (merge develop → main)

```bash
git checkout main
git merge develop
git push origin main
# → Le CI docker.yml rebuild et push l'image :latest automatiquement
# → Sur le serveur :
git pull
docker compose up -d --build
```

### Arrêter uniquement le staging

```bash
docker compose -f docker-compose.dev.yml down
```

---

## Volumes et données

Les deux environnements utilisent des volumes Docker **séparés** :

| Environnement | Volume Docker      | Fichier SQLite   |
|---------------|--------------------|------------------|
| Production    | `livechat_data`    | `sqlite.db`      |
| Staging       | `livechat_dev_data`| `sqlite-dev.db`  |

Les bases de données sont totalement isolées. Pas de risque de pollution des données de prod.

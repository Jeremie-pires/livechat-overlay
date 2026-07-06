# LiveChatCCB Desktop

Application Windows compacte pour afficher le livechat en overlay par-dessus un jeu, sans capturer les clics.

## Ce que fait cette version

- petite interface de contrôle
- fenêtre overlay transparente, toujours au-dessus, non cliquable
- choix de l'écran cible
- réglage de volume des médias
- connexion automatique à la salle du serveur Discord au lancement
- persistance des réglages dans `%APPDATA%`

## Démarrage en développement

```bash
npm install
npm run dev
```

## Packaging Windows

```bash
npm run dist
```

L’installateur NSIS sortira dans `release/` et s’installe côté utilisateur, sans terminal et sans droits admin dans le cas standard.

## Réglages attendus

- `backendUrl` : URL du backend public, par défaut `http://localhost:3000`
- `guildId` : ID du serveur Discord utilisé par le client
- `screenId` : écran choisi pour l’overlay
- `volume` : volume des médias entre 0 et 100

## Remarque

Cette base charge encore le client public `/client` du backend. C’est volontaire pour séparer proprement le front desktop du back déjà en place, puis itérer ensuite sur l’UI et les échanges plus fins.

# Politique de Confidentialité — LiveChat CCB

**Dernière mise à jour : 10 juillet 2026**

---

## 1. Présentation

LiveChat CCB est un bot Discord open source permettant de diffuser des médias (images, vidéos, audio, liens, texte) vers des écrans connectés via un client navigateur. Le code source est disponible publiquement sur [GitHub]https://github.com/Jeremie-pires/livechat-overlay.git). Il est développé et opéré par **Jerezouz** (ci-après « l'Opérateur »).

Cette politique de confidentialité s'applique à l'**instance officielle** du Bot hébergée par l'Opérateur. Elle explique quelles données sont collectées, pourquoi, comment elles sont utilisées, et quels sont vos droits.

---

## 2. Données collectées

### 2.1 Données liées aux serveurs Discord (Guildes)

Lors de l'ajout du bot sur un serveur, les informations suivantes sont enregistrées :

- **Identifiant du serveur (Guild ID)** — identifiant technique Discord
- **Configuration du serveur** — salon cible, durées d'affichage paramétrées par les administrateurs
- **État de la file d'attente** — contenu soumis via les commandes slash (liens, textes, URLs de médias)

### 2.2 Données liées aux utilisateurs

Lors de l'utilisation du client de diffusion (dashboard navigateur ou client desktop) :

- **Identifiant Discord (User ID)** — collecté lors de la connexion à une session
- **Pseudo Discord (Display Name)** — affiché dans la liste des utilisateurs connectés
- **Avatar Discord** — URL de l'avatar récupéré via l'API Discord, utilisé à des fins d'affichage uniquement
- **Jeton de session** — stocké sous forme de hash SHA-256, jamais en clair

### 2.3 Données techniques

- **Journaux d'événements du bot** — démarrages, arrêts, erreurs (type, message, horodatage) — conservés à des fins de maintenance et de fiabilité
- **Échantillons de latence** — temps d'attente en file, limités aux 50 derniers enregistrements
- **Statistiques globales** — compteurs agrégés (nombre de médias envoyés, etc.), sans identification individuelle

---

## 3. Finalités du traitement

| Donnée | Finalité | Base légale |
|---|---|---|
| Guild ID + configuration | Faire fonctionner le bot sur le serveur | Intérêt légitime |
| Contenu de la file d'attente | Diffuser les médias demandés | Exécution du service |
| User ID + pseudo + avatar | Afficher la liste des utilisateurs connectés | Consentement implicite (connexion volontaire) |
| Jeton de session | Authentifier les connexions au client | Sécurité du service |
| Journaux techniques | Détecter et corriger les pannes | Intérêt légitime |

---

## 4. Durée de conservation

- **File d'attente (Queue)** : supprimée après diffusion ou suppression manuelle
- **Sessions utilisateurs** : supprimées à la déconnexion ou expiration
- **Configuration des serveurs** : conservée tant que le bot est présent sur le serveur, supprimée sur demande ou lors du retrait du bot
- **Journaux techniques** : conservés jusqu'à 100 entrées (rotation automatique)
- **Échantillons de latence** : 50 derniers enregistrements (rotation automatique)

---

## 5. Partage des données

Les données collectées **ne sont pas vendues, partagées ni transmises à des tiers**, à l'exception des services suivants indispensables au fonctionnement :

- **Discord API** — pour la récupération des profils utilisateurs et l'envoi de messages ; soumis à la [politique de confidentialité de Discord](https://discord.com/privacy)
- **Google Text-to-Speech (gTTS)** — pour la synthèse vocale des messages texte ; soumis à la [politique de confidentialité de Google](https://policies.google.com/privacy)

---

## 6. Instances auto-hébergées (self-hosting)

Le code source de LiveChat CCB étant open source, toute personne peut déployer sa propre instance.

**L'Opérateur n'a aucun contrôle sur les instances tierces** et décline toute responsabilité quant aux données collectées par celles-ci. Si vous utilisez une instance auto-hébergée par un tiers, la politique de confidentialité applicable est celle de l'opérateur de cette instance, non la présente politique.

Si vous êtes vous-même opérateur d'une instance auto-hébergée, vous êtes seul responsable du traitement des données de vos utilisateurs et de la conformité à la réglementation applicable (RGPD ou équivalent).

---

## 7. Sécurité

- Les données sont stockées localement sur un serveur privé (base de données SQLite)
- Les jetons de session sont hachés en SHA-256 avant stockage
- Aucune donnée sensible n'est stockée en clair

---

## 8. Vos droits (RGPD)

Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :

- **Droit d'accès** : obtenir une copie des données vous concernant
- **Droit de rectification** : faire corriger des données inexactes
- **Droit à l'effacement** : demander la suppression de vos données
- **Droit d'opposition** : vous opposer à un traitement fondé sur l'intérêt légitime

Pour exercer ces droits, contactez l'Opérateur via le **serveur Discord support** : [https://discord.gg/PU56ufhSqV](https://discord.gg/PU56ufhSqV)

---

## 9. Données des mineurs

LiveChat CCB n'est pas destiné aux personnes de moins de 13 ans (conformément aux conditions d'utilisation de Discord). Aucune collecte intentionnelle de données concernant des mineurs n'est effectuée.

---

## 10. Modifications

Cette politique peut être mise à jour à tout moment. La date de dernière mise à jour est indiquée en haut du document. L'utilisation continue du bot après modification vaut acceptation des nouvelles conditions.

---

## 11. Contact

**Opérateur** : Jerezouz  
**Support** : [https://discord.gg/PU56ufhSqV](https://discord.gg/PU56ufhSqV)  
**Site** : [https://www.livechatccb.online/](https://www.livechatccb.online/)

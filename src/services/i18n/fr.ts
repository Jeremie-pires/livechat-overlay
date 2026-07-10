import { enLang } from './en';

export const frLang: typeof enLang = {
  commandError: 'Problème avec cette commande ! Veuillez vérifier les logs !',
  i18nLoaded: 'Langue française chargée !',
  serverStarted: 'Le serveur est lancé !',
  success: 'Succès !',
  error: 'Erreur !',
  notAllowed: 'Action non autorisée !',

  discordCommands: 'Chargement des commandes Discord',
  discordCommandLoaded: 'Commande chargée : /{{command}} ✅',
  discordInvite: 'Pour inviter le bot : {{link}}',
  discordBotReady: 'En ligne ! Connecté en tant que {{username}}',

  howToUseTitle: "Comment m'utiliser ?",
  howToUseDescription:
    "Pour m'utiliser, vous devez d'abord faire un `/client` pour avoir le lien à intégrer sur votre OBS ou XSplit.\n\nAprès, vous pouvez faire un `/help` pour obtenir toutes les commandes que vous pouvez utiliser pour envoyer du contenu sur le stream.",

  aliveCommand: 'dispo',
  aliveCommandDescription: 'Vérifiez si le bot est vivant',
  aliveCommandsAnswer: '{{username}}, Je suis en vie !',

  clientCommand: 'client',
  clientCommandDescription: 'Obtenez un lien OBS pour intégrer LiveChat',
  clientCommandsAnswer: 'Voici les infos de connexion à entrer dans l\'app :',
  clientCommandsUrlLabel: 'URL du serveur',
  clientCommandsGuildIdLabel: 'ID de la Guild Discord',

  sendCommand: 'msg',
  sendCommandDescription: 'Envoyer du contenu sur le stream',
  sendCommandOptionURL: 'lien',
  sendCommandOptionURLDescription: 'Lien du contenu sur le stream',
  sendCommandOptionText: 'texte',
  sendCommandOptionTextDescription: 'Texte à afficher',
  sendCommandOptionMedia: 'média',
  sendCommandOptionMediaDescription: 'Média à afficher',
  sendCommandOptionDuration: 'temps',
  sendCommandOptionDurationDescription: 'Temps d\'affichage en secondes ou "full" pour les vidéos',
  sendCommandAnswer: 'Contenu reçu ! Il sera bientôt joué !',

  hideSendCommand: 'cmsg',
  hideSendCommandDescription: 'Envoyer du contenu sur le stream (mais caché 😈)',
  hideSendCommandOptionURL: 'lien',
  hideSendCommandOptionURLDescription: 'Lien du contenu sur le stream',
  hideSendCommandOptionText: 'texte',
  hideSendCommandOptionTextDescription: 'Texte à afficher',
  hideSendCommandOptionMedia: 'média',
  hideSendCommandOptionMediaDescription: 'Média à afficher',
  hideSendCommandOptionDuration: 'temps',
  hideSendCommandOptionDurationDescription: 'Temps d\'affichage en secondes ou "full" pour les vidéos',
  hideSendCommandAnswer: 'Contenu reçu ! Il sera bientôt joué !',

  talkCommand: 'dire',
  talkCommandDescription: 'Demandez à un bot de dire quelque chose',
  talkCommandOptionText: 'texte',
  talkCommandOptionTextDescription: 'Texte à afficher',
  talkCommandOptionVoice: 'dire',
  talkCommandOptionVoiceDescription: 'Texte à dire',
  talkCommandAnswer: 'Contenu reçu ! Il sera bientôt joué !',

  hideTalkCommand: 'cdire',
  hideTalkCommandDescription: 'Demandez à un bot de dire quelque chose (mais caché 😈)',
  hideTalkCommandOptionText: 'texte',
  hideTalkCommandOptionTextDescription: 'Texte à afficher',
  hideTalkCommandOptionVoice: 'dire',
  hideTalkCommandOptionVoiceDescription: 'Texte à dire',
  hideTalkCommandAnswer: 'Contenu reçu ! Il sera bientôt joué !',

  setDefaultTimeCommand: 'config-defaut',
  setDefaultTimeCommandDescription:
    "Définir le temps par défaut pour l'affichage (Par défaut : 5 seconds) (En secondes)",
  setDefaultTimeCommandOptionText: 'nombre',
  setDefaultTimeCommandOptionTextDescription: 'Nombre de seconds',
  setDefaultTimeCommandAnswer: 'Le temps par défaut défini !',

  setMaxTimeCommand: 'config-max',
  setMaxTimeCommandDescription:
    "Définir le temps maximal pour l'affichage (En secondes) | 0 remet la valeur par défaut",
  setMaxTimeCommandOptionText: 'nombre',
  setMaxTimeCommandOptionTextDescription: 'Nombre de seconds',
  setMaxTimeCommandAnswer: 'Temps maximum défini !',

  setDisplayMediaFullCommand: 'config-displayfull',
  setDisplayMediaFullCommandDescription: 'Définir si les médias doivent être affichés en plein écran',
  setDisplayMediaFullCommandOptionText: 'value',
  setDisplayMediaFullCommandOptionTextDescription: 'Oui  / Non',
  setDisplayMediaFullCommandAnswer: 'Valeur défini !',

  stopCommand: 'stop',
  stopCommandDescription: 'Supprime le média',
  stopCommandAnswer: 'Média interrompu !',

  setupCommand: 'setup',
  setupCommandDescription: 'Configurer le canal du bot pour ce serveur',
  setupCommandOptionChannelDescription: 'Canal texte où les commandes du bot seront acceptées',
  setupCommandAnswer: 'Bot configuré ! Les commandes seront acceptées dans {{channel}}.',
  noChannelConfigured: "Ce serveur n'a pas encore de canal configuré. Un administrateur doit d'abord faire `/setup #canal`.",

  announceCommand: 'announce',
  announceCommandDescription: 'Envoyer une annonce à tous les serveurs (propriétaire du bot uniquement)',
  announceCommandOptionDescription: 'Message à diffuser',
  announceCommandTitle: '📢 Annonce',
  announceCommandAnswer: 'Message envoyé à {{count}} serveur(s).',
  announceGuildCommandDescription: 'Envoyer une annonce à un serveur précis (propriétaire du bot uniquement)',
  announceGuildCommandOptionGuildId: 'ID du serveur cible',

  invalidDuration: 'La durée doit être comprise entre 1 et 3600 secondes.',
  invalidUrl: 'Le lien fourni est invalide.',
  noContentProvided: 'Tu dois fournir au moins un lien, un média ou un texte.',
  ttsTextTooLong: 'Le texte est trop long (200 caractères maximum).',
};

import {
  REST,
  Client,
  Events,
  Collection,
  Routes,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  IntentsBitField,
} from 'discord.js';
import { logBotEvent, notifyOwner } from '../services/botLogger';
import { broadcastToAllGuilds } from '../services/broadcast';
import { aliveCommand } from '../components/discord/aliveCommand';
import { sendCommand } from '../components/messages/sendCommand';
import { hideSendCommand } from '../components/messages/hidesendCommand';
import { loadMessagesWorker } from '../components/messages/messagesWorker';
import { talkCommand } from '../components/messages/talkCommand';
import { hideTalkCommand } from '../components/messages/hidetalkCommand';
import { clientCommand } from '../components/discord/clientCommand';
import { helpCommand } from '../components/discord/helpCommand';
import { infoCommand } from '../components/discord/infoCommand';
import { setDefaultTimeCommand } from '../components/discord/setDefaultTimeCommand';
import { setMaxTimeCommand } from '../components/discord/setMaxTimeCommand';
import { stopCommand } from '../components/messages/stopCommand';
import { setupCommand } from '../components/discord/setupCommand';
import { announceCommand } from '../components/discord/announceCommand';
import { maintenanceCommand } from '../components/discord/maintenanceCommand';

const handleShutdown = async () => {
  logger.info('[DISCORD] Shutdown signal received — sending announcement...');
  await Promise.race([
    Promise.all([
      logBotEvent('STOP', 'Arrêt propre via SIGTERM/SIGINT'),
      notifyOwner('STOP', "Le bot s’éteint proprement (SIGTERM/SIGINT)."),
      broadcastToAllGuilds(
        '🔴 Maintenance en cours',
        "Le bot va s’éteindre quelques minutes pour maintenance. Il sera bientôt de retour !",
        0xe74c3c,
      ),
    ]),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  process.exit(0);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const loadDiscord = async (fastify: FastifyCustomInstance) => {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  global.discordRest = rest;

  const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });
  global.discordClient = client;

  // Clear stale queue entries from before the restart
  const deleted = await prisma.queue.deleteMany({});
  if (deleted.count > 0) {
    logger.info(`[QUEUE] Cleared ${deleted.count} stale item(s) from queue on startup`);
  }

  // Load all discord commands
  await loadDiscordCommands(fastify);
  loadDiscordCommandsHandler();
  loadMessagesWorker(fastify);

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`[DISCORD] ${rosetty.t('discordBotReady', { username: readyClient.user.tag })}`);
    logger.info(
      `[DISCORD] ${rosetty.t('discordInvite', {
        link: `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands`,
      })}`,
    );

    // Announce only when maintenance mode is off AND the last event was a planned STOP.
    // This prevents spamming guild users during crash-loops or active development.
    let shouldAnnounce = true;
    try {
      const [lastEvent, stats] = await Promise.all([
        prisma.botEvent.findFirst({ orderBy: { id: 'desc' } }),
        prisma.stats.findUnique({ where: { id: 'singleton' } }),
      ]);
      const silentMode = stats?.silentMode ?? false;
      shouldAnnounce = !silentMode && (!lastEvent || lastEvent.type === 'STOP');
    } catch {}

    await Promise.all([
      logBotEvent('START', `Bot connecté en tant que ${readyClient.user.tag}`),
      shouldAnnounce
        ? broadcastToAllGuilds('🟢 En ligne !', 'Le bot est de retour et prêt à recevoir du contenu !', 0x2ecc71)
        : Promise.resolve(),
    ]);
  });

  process.once('SIGTERM', handleShutdown);
  process.once('SIGINT', handleShutdown);

  client.on(Events.GuildCreate, async (g) => {
    const channel = g.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.permissionsFor(g.members.me!).has(PermissionFlagsBits.SendMessages),
    );

    if (channel && channel.isTextBased()) {
      try {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(rosetty.t('howToUseTitle')!)
              .setDescription(rosetty.t('howToUseDescription')!)
              .setColor(0x3498db),
          ],
        });
      } catch {}
    }
  });

  await client.login(env.DISCORD_TOKEN);
};

const loadDiscordCommands = async (fastify: FastifyCustomInstance) => {
  try {
    logger.info(`[DISCORD] ${rosetty.t('discordCommands')}`);

    //@ts-ignore
    discordClient.commands = new Collection();

    const discordCommandsToRegister = [];

    const commands = [
      aliveCommand(),
      sendCommand(),
      talkCommand(),
      clientCommand(),
      helpCommand(),
      infoCommand(),
      setDefaultTimeCommand(),
      setMaxTimeCommand(),
      stopCommand(fastify),
      setupCommand(),
      announceCommand(),
      maintenanceCommand(),
    ];
    const hideCommands = [hideSendCommand(), hideTalkCommand()];

    if (env.HIDE_COMMANDS_DISABLED !== 'true') {
      commands.push(...hideCommands);
    }

    global.commandsLoaded = [];

    for (const command of commands) {
      //@ts-ignore
      discordClient.commands.set(command.data.name, command);
      //@ts-ignore
      discordCommandsToRegister.push(command.data.toJSON());

      global.commandsLoaded.push(command.data.name);

      logger.info(`[DISCORD] ${rosetty.t('discordCommandLoaded', { command: command.data.name })}`);
    }

    await discordRest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: discordCommandsToRegister });
  } catch (error) {
    logger.error(error);
  }
};

const loadDiscordCommandsHandler = () => {
  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    //@ts-ignore
    const command = discordClient.commands.get(interaction.commandName);

    if (!command) {
      return;
    }

    if (!command.bypassChannelCheck) {
      const guild = await prisma.guild.findFirst({ where: { id: interaction.guildId! } });

      if (!guild?.channelId) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(rosetty.t('error')!)
              .setDescription(rosetty.t('noChannelConfigured')!)
              .setColor(0xe74c3c),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.channelId !== guild.channelId) {
        const channelMention = `<#${guild.channelId}>`;
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(rosetty.t('error')!)
              .setDescription(`Use this bot only in ${channelMention}.`)
              .setColor(0xe74c3c),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      await command.handler(interaction, discordClient);
    } catch (error) {
      logger.error(error);

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            embeds: [
              new EmbedBuilder()
                .setTitle(rosetty.t('error')!)
                .setDescription(rosetty.t('commandError')!)
                .setColor(0xe74c3c),
            ],
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(rosetty.t('error')!)
                .setDescription(rosetty.t('commandError')!)
                .setColor(0xe74c3c),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch {
        // Interaction token expired — swallow silently
      }
    }
  });
};

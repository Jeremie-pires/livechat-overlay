import { CommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

export const clientCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('clientCommand')!)
    .setDescription(rosetty.t('clientCommandDescription')!),
  bypassChannelCheck: true,
  handler: async (interaction: CommandInteraction) => {
    const parsed = new URL(env.API_URL);
    parsed.port = '';
    const baseUrl = parsed.toString().replace(/\/$/, '');
    const guildId = interaction.guildId ?? '';
    const discordUserId = interaction.user.id;
    const displayName = interaction.user.displayName || interaction.user.username;

    let session = await prisma.clientSession.findFirst({
      where: { discordUserId, guildId },
    });

    if (!session) {
      session = await prisma.clientSession.create({
        data: { discordUserId, displayName, guildId },
      });
    } else if (session.displayName !== displayName) {
      session = await prisma.clientSession.update({
        where: { token: session.token },
        data: { displayName },
      });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(rosetty.t('clientCommandsAnswer')!)
          .addFields(
            { name: rosetty.t('clientCommandsUrlLabel')!, value: `\`${baseUrl}\``, inline: false },
            { name: rosetty.t('clientCommandsGuildIdLabel')!, value: `\`${guildId}\``, inline: false },
            { name: '🔑 Token client', value: `\`${session.token}\`\nColle ce token dans l'app desktop (onglet Serveur).`, inline: false },
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

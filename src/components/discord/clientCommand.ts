import { createHash, randomUUID } from 'crypto';
import { CommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

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

    const token = randomUUID();
    const tokenHash = hashToken(token);

    await prisma.$transaction([
      prisma.clientSession.deleteMany({ where: { discordUserId, guildId } }),
      prisma.clientSession.create({ data: { tokenHash, discordUserId, displayName, guildId } }),
    ]);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(rosetty.t('clientCommandsAnswer')!)
          .addFields(
            { name: rosetty.t('clientCommandsUrlLabel')!, value: `\`${baseUrl}\``, inline: false },
            { name: rosetty.t('clientCommandsGuildIdLabel')!, value: `\`${guildId}\``, inline: false },
            {
              name: '🔑 Token client',
              value: `\`${token}\`\nColle ce token dans l'app desktop (onglet Serveur).\n⚠️ Ce token remplace l'ancien — mets à jour l'app si déjà configurée.`,
              inline: false,
            },
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

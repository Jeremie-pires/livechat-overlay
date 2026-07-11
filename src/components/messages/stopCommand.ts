import { CommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { env } from '../../services/env';

export const stopCommand = (fastify: FastifyCustomInstance) => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('stopCommand')!)
    .setDescription(rosetty.t('stopCommandDescription')!),
  handler: async (interaction: CommandInteraction) => {
    fastify.io.to(`${env.APP_ENV}:messages-${interaction.guildId!}`).emit('stop');

    await prisma.guild.upsert({
      where: { id: interaction.guildId! },
      create: { id: interaction.guildId!, busyUntil: null },
      update: { busyUntil: null },
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('stopCommandAnswer')!)
          .setColor(0x2ecc71),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

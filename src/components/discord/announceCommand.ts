import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { broadcastToAllGuilds } from '../../services/broadcast';

export const announceCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription(rosetty.t('announceCommandDescription')!)
    .addStringOption((option) =>
      option.setName('message').setDescription(rosetty.t('announceCommandOptionDescription')!).setRequired(true),
    ),
  bypassChannelCheck: true,
  handler: async (interaction: ChatInputCommandInteraction) => {
    if (!env.DISCORD_OWNER_ID || interaction.user.id !== env.DISCORD_OWNER_ID) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = interaction.options.getString('message', true);
    const results = await broadcastToAllGuilds(rosetty.t('announceCommandTitle')!, message, 0x3498db);

    const sent = results.filter((r) => r.status === 'SUCCESS').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;

    const summary =
      rosetty.t('announceCommandAnswer', { count: String(sent) })! +
      (failed > 0 ? '\n' + rosetty.t('announceCommandFailures', { count: String(failed) })! : '');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(summary)
          .setColor(failed > 0 ? 0xf59e0b : 0x2ecc71),
      ],
    });
  },
});

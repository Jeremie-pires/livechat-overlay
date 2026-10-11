import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { applyMaintenanceMode } from '../../services/broadcast';

export const maintenanceCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Active ou désactive le mode maintenance (annonces de redémarrage suspendues)')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('on = suspendre les annonces, off = rétablir les annonces')
        .setRequired(true)
        .addChoices(
          { name: '🔧 Activer la maintenance', value: 'on' },
          { name: '🟢 Désactiver la maintenance', value: 'off' },
        ),
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

    const silentMode = interaction.options.getString('mode', true) === 'on';

    await applyMaintenanceMode(silentMode);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(silentMode ? '🔧 Mode maintenance activé' : '🟢 Mode maintenance désactivé')
          .setDescription(
            silentMode
              ? 'Les annonces de redémarrage sont suspendues.'
              : 'Les annonces ont été rétablies et les serveurs notifiés.',
          )
          .setColor(silentMode ? 0xf59e0b : 0x2ecc71),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export const clientCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('clientCommand')!)
    .setDescription(rosetty.t('clientCommandDescription')!),
  bypassChannelCheck: true,
  handler: async (interaction: CommandInteraction) => {
    const parsed = new URL(env.API_URL);
    parsed.port = '';
    const url = parsed.toString().replace(/\/$/, '');
    const guildId = interaction.guildId ?? '';

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(rosetty.t('clientCommandsAnswer')!)
          .addFields(
            { name: rosetty.t('clientCommandsUrlLabel')!, value: `\`${url}\``, inline: false },
            { name: rosetty.t('clientCommandsGuildIdLabel')!, value: `\`${guildId}\``, inline: false },
          ),
      ],
    });
  },
});

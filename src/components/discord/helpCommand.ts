import { CommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

export const helpCommand = () => ({
  data: new SlashCommandBuilder().setName('help').setDescription('List of Commands'),
  bypassChannelCheck: true,
  handler: async (interaction: CommandInteraction) => {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Commands :')
          .setDescription(global.commandsLoaded.map((v) => `\`/${v}\``).join(', ')),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

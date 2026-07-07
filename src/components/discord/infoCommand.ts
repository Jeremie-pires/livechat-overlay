import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export const infoCommand = () => ({
  data: new SlashCommandBuilder().setName('info').setDescription('Bot Informations'),
  bypassChannelCheck: true,
  handler: async (interaction: CommandInteraction) => {
    await interaction.reply({
      embeds: [
        new EmbedBuilder().setTitle(`Developed by Jerezouz - ${new Date().getFullYear()}`).setDescription(`
          [GitHub](https://github.com/Jeremie-pires)
          [Personal Website](https://lewebnantais.fr)
          `),
      ],
      ephemeral: true,
    });
  },
});

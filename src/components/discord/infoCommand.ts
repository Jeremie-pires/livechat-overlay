import { CommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

export const infoCommand = () => ({
  data: new SlashCommandBuilder().setName('info').setDescription('Bot Informations'),
  bypassChannelCheck: true,
  handler: async (interaction: CommandInteraction) => {
    await interaction.reply({
      embeds: [
        new EmbedBuilder().setTitle(`Developed by Jerezouz - ${new Date().getFullYear()}`).setDescription(`
          [Site du Livechat](https://livechatccb.online)
          [GitHub](https://github.com/Jeremie-pires)
          [Mon site de création de sites web](https://lewebnantais.fr)
          `),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

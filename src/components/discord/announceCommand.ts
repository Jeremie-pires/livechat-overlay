import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

export const announceCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription(rosetty.t('announceCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription(rosetty.t('announceCommandOptionDescription')!)
        .setRequired(true),
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
    const guilds = await prisma.guild.findMany({ where: { channelId: { not: null } }, select: { id: true, channelId: true } });

    let sent = 0;
    for (const guild of guilds) {
      try {
        const channel = await discordClient.channels.fetch(guild.channelId!);
        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).send({
            embeds: [
              new EmbedBuilder()
                .setTitle(rosetty.t('announceCommandTitle')!)
                .setDescription(message)
                .setColor(0x3498db),
            ],
          });
          sent++;
        }
      } catch {
        // Guild may have removed the bot or deleted the channel
      }
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('announceCommandAnswer', { count: String(sent) })!)
          .setColor(0x2ecc71),
      ],
    });
  },
});

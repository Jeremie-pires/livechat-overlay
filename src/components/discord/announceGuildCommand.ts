import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

export const announceGuildCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('announce-guild')
    .setDescription(rosetty.t('announceGuildCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName('guild_id')
        .setDescription(rosetty.t('announceGuildCommandOptionGuildId')!)
        .setRequired(true),
    )
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

    const guildId = interaction.options.getString('guild_id', true);
    const message = interaction.options.getString('message', true);

    const guild = await prisma.guild.findFirst({
      where: { id: guildId },
      select: { channelId: true },
    });

    if (!guild?.channelId) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('noChannelConfigured')!)
            .setColor(0xe74c3c),
        ],
      });
      return;
    }

    try {
      const channel = await discordClient.channels.fetch(guild.channelId);
      if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text-based');

      await (channel as TextChannel).send({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('announceCommandTitle')!)
            .setDescription(message)
            .setColor(0x3498db),
        ],
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('success')!)
            .setDescription(rosetty.t('announceCommandAnswer', { count: '1' })!)
            .setColor(0x2ecc71),
        ],
      });
    } catch {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('commandError')!)
            .setColor(0xe74c3c),
        ],
      });
    }
  },
});

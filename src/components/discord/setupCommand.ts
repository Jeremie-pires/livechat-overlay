import { ChannelType, ChatInputCommandInteraction, Client, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const setupCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription(rosetty.t('setupCommandDescription')!)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription(rosetty.t('setupCommandOptionChannelDescription')!)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),
  bypassChannelCheck: true,
  handler: async (interaction: ChatInputCommandInteraction, discordClient: Client) => {
    const userId = interaction.user.id;
    const guildMember = await discordClient.guilds
      .fetch(interaction.guildId!)
      .then((guild) => guild.members.fetch(userId));

    if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);

    await prisma.guild.upsert({
      where: { id: interaction.guildId! },
      create: { id: interaction.guildId!, channelId: channel.id },
      update: { channelId: channel.id },
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('setupCommandAnswer', { channel: `<#${channel.id}>` })!)
          .setColor(0x2ecc71),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

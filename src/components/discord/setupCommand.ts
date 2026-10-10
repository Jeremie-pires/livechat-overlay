import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { assertAdminPermission } from '../../services/discord-utils';

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!(await assertAdminPermission(interaction, discordClient))) return;

    const channel = interaction.options.getChannel('channel', true);

    await prisma.guild.upsert({
      where: { id: interaction.guildId! },
      create: { id: interaction.guildId!, channelId: channel.id },
      update: { channelId: channel.id },
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('setupCommandAnswer', { channel: `<#${channel.id}>` })!)
          .setColor(0x2ecc71),
      ],
    });
  },
});

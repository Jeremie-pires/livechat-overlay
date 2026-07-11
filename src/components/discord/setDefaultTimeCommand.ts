import {
  Client,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const setDefaultTimeCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('setDefaultTimeCommand')!)
    .setDescription(rosetty.t('setDefaultTimeCommandDescription')!)
    .addIntegerOption((option) =>
      option
        .setName(rosetty.t('setDefaultTimeCommandOptionText')!)
        .setDescription(rosetty.t('setDefaultTimeCommandOptionTextDescription')!)
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3600),
    ),
  handler: async (interaction: ChatInputCommandInteraction, discordClient: Client) => {
    const number = interaction.options.get(rosetty.t('setDefaultTimeCommandOptionText')!)?.value as number;

    if (number < 1 || number > 3600) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('invalidDuration')!)
            .setColor(0xe74c3c),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.user.id;
    const guildMember = await discordClient.guilds
      .fetch(interaction.guildId!)
      .then((guild) => guild.members.fetch(userId!));

    if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await prisma.guild.upsert({
      where: { id: interaction.guildId! },
      create: { id: interaction.guildId!, defaultMediaTime: number },
      update: { defaultMediaTime: number },
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('setDefaultTimeCommandAnswer')!)
          .setColor(0x2ecc71),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

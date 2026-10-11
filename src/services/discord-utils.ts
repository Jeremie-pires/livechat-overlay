import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { I18nKey } from './i18n/loader';

export const assertAdminPermission = async (
  interaction: ChatInputCommandInteraction,
  discordClient: Client,
): Promise<boolean> => {
  const guildMember = await discordClient.guilds
    .fetch(interaction.guildId!)
    .then((guild) => guild.members.fetch(interaction.user.id));

  if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
    });
    return false;
  }
  return true;
};

interface SetGuildTimeOpts {
  commandNameKey: I18nKey;
  commandDescriptionKey: I18nKey;
  optionNameKey: I18nKey;
  optionDescriptionKey: I18nKey;
  persist: (guildId: string, value: number) => Promise<void>;
  successKey: I18nKey;
}

export const createSetGuildTimeCommand = (opts: SetGuildTimeOpts) => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t(opts.commandNameKey)!)
    .setDescription(rosetty.t(opts.commandDescriptionKey)!)
    .addIntegerOption((option) =>
      option
        .setName(rosetty.t(opts.optionNameKey)!)
        .setDescription(rosetty.t(opts.optionDescriptionKey)!)
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3600),
    ),
  handler: async (interaction: ChatInputCommandInteraction, discordClient: Client) => {
    await interaction.deferReply({ ephemeral: true });

    const number = interaction.options.get(rosetty.t(opts.optionNameKey)!)?.value as number;

    if (number < 1 || number > 3600) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('invalidDuration')!)
            .setColor(0xe74c3c),
        ],
      });
      return;
    }

    if (!(await assertAdminPermission(interaction, discordClient))) return;

    await opts.persist(interaction.guildId!, number);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t(opts.successKey)!)
          .setColor(0x2ecc71),
      ],
    });
  },
});

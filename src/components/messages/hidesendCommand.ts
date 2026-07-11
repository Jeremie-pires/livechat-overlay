import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { getDurationFromGuildId } from '../../services/utils';

const MAX_DURATION_SECONDS = 3600;

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export const hideSendCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('hideSendCommand')!)
    .setDescription(rosetty.t('hideSendCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionURL')!)
        .setDescription(rosetty.t('hideSendCommandOptionURLDescription')!),
    )
    .addAttachmentOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionMedia')!)
        .setDescription(rosetty.t('hideSendCommandOptionMediaDescription')!),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionText')!)
        .setDescription(rosetty.t('hideSendCommandOptionTextDescription')!)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionDuration')!)
        .setDescription(rosetty.t('hideSendCommandOptionDurationDescription')!)
        .setRequired(false),
    ),
  handler: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const url = interaction.options.get(rosetty.t('hideSendCommandOptionURL')!)?.value as string | undefined;
    const text = interaction.options.get(rosetty.t('hideSendCommandOptionText')!)?.value as string | undefined;
    const media = interaction.options.get(rosetty.t('hideSendCommandOptionMedia')!)?.attachment?.proxyURL;
    const customDurationString = interaction.options.get(rosetty.t('hideSendCommandOptionDuration')!)?.value as
      | string
      | undefined;
    let mediaContentType = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.contentType;
    let mediaDuration = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.duration;
    let mediaIsShort = false;

    if (!url && !media && !text) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('noContentProvided')!)
            .setColor(0xe74c3c),
        ],
      });
      return;
    }

    if (url && !isValidUrl(url)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder().setTitle(rosetty.t('error')!).setDescription(rosetty.t('invalidUrl')!).setColor(0xe74c3c),
        ],
      });
      return;
    }

    let finalDuration: number | undefined = undefined;

    if (customDurationString) {
      const trimmed = customDurationString.trim().toLowerCase();
      if (trimmed === 'full') {
        finalDuration = mediaDuration ? Math.ceil(mediaDuration) : 0;
      } else {
        const parsed = parseInt(trimmed, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > MAX_DURATION_SECONDS) {
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
        finalDuration = parsed;
      }
    }

    let additionalContent;
    if ((!mediaContentType || !mediaDuration) && (media || url)) {
      additionalContent = await getContentInformationsFromUrl((media || url) as string);
    }

    if ((mediaContentType === undefined || mediaContentType === null) && additionalContent?.contentType) {
      mediaContentType = additionalContent.contentType;
    }

    if (mediaContentType?.startsWith('video/')) {
      const height = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.height;
      const width = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.width;
      if (height && width) {
        mediaIsShort = height > width;
      }
    }

    if ((mediaDuration === undefined || mediaDuration === null) && additionalContent?.mediaDuration) {
      mediaDuration = additionalContent.mediaDuration;
    }

    if (additionalContent?.mediaIsShort) {
      mediaIsShort = additionalContent.mediaIsShort || false;
    }

    const isVideo = mediaContentType?.startsWith('video/') || mediaContentType?.startsWith('audio/');

    if (finalDuration === undefined && isVideo) {
      finalDuration = mediaDuration ? Math.ceil(mediaDuration) : 0;
    }

    await prisma.queue.create({
      data: {
        content: JSON.stringify({
          url,
          text,
          media,
          mediaContentType,
          mediaDuration: await getDurationFromGuildId(
            finalDuration !== undefined ? Math.ceil(finalDuration) : undefined,
            interaction.guildId!,
          ),
          mediaIsShort,
        }),
        type: QueueType.MESSAGE,
        discordGuildId: interaction.guildId!,
        duration: await getDurationFromGuildId(
          finalDuration !== undefined ? Math.ceil(finalDuration) : undefined,
          interaction.guildId!,
        ),
      },
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('hideSendCommandAnswer')!)
          .setColor(0x2ecc71),
      ],
    });
  },
});

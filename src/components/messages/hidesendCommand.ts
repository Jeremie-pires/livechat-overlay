import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { measureContentProcessing, ContentInfo } from '../../services/telemetry';
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

function parseDuration(trimmed: string, mediaDuration: number | null | undefined): number | 'error' {
  if (trimmed === 'full') {
    return mediaDuration ? Math.ceil(mediaDuration) : 0;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_DURATION_SECONDS) {
    return 'error';
  }
  return parsed;
}

function detectShortFromAttachment(interaction: ChatInputCommandInteraction, optionKey: string): boolean {
  const height = interaction.options.get(optionKey)?.attachment?.height;
  const width = interaction.options.get(optionKey)?.attachment?.width;
  return !!(height && width && height > width);
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
    const discordReceivedAt = interaction.createdTimestamp;
    await interaction.deferReply({ ephemeral: true });

    const mediaKey = rosetty.t('hideSendCommandOptionMedia')!;
    const url = interaction.options.get(rosetty.t('hideSendCommandOptionURL')!)?.value as string | undefined;
    const text = interaction.options.get(rosetty.t('hideSendCommandOptionText')!)?.value as string | undefined;
    const media = interaction.options.get(mediaKey)?.attachment?.proxyURL;
    const customDurationString = interaction.options.get(rosetty.t('hideSendCommandOptionDuration')!)?.value as
      | string
      | undefined;
    let mediaContentType = interaction.options.get(mediaKey)?.attachment?.contentType;
    let mediaDuration = interaction.options.get(mediaKey)?.attachment?.duration;
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

    let finalDuration: number | undefined;

    if (customDurationString) {
      const durationResult = parseDuration(customDurationString.trim().toLowerCase(), mediaDuration);
      if (durationResult === 'error') {
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
      finalDuration = durationResult;
    }

    let processingMs = 0;
    let additionalContent: ContentInfo | undefined;
    if ((!mediaContentType || !mediaDuration) && (media || url)) {
      const result = await measureContentProcessing((media ?? url) as string);
      processingMs = result.processingMs;
      additionalContent = result.contentInfo;
    }

    mediaContentType = mediaContentType ?? additionalContent?.contentType;

    if (mediaContentType?.startsWith('video/')) {
      mediaIsShort = detectShortFromAttachment(interaction, mediaKey);
    }

    mediaDuration = mediaDuration ?? additionalContent?.mediaDuration;

    if (additionalContent?.mediaIsShort) {
      mediaIsShort = additionalContent.mediaIsShort;
    }

    const isVideo = mediaContentType?.startsWith('video/') || mediaContentType?.startsWith('audio/');

    if (finalDuration === undefined && isVideo && mediaDuration) {
      finalDuration = Math.ceil(mediaDuration);
    }

    const resolvedDuration = await getDurationFromGuildId(
      finalDuration !== undefined ? Math.ceil(finalDuration) : undefined,
      interaction.guildId!,
    );

    await prisma.queue.create({
      data: {
        content: JSON.stringify({
          url: additionalContent?.resolvedUrl ?? url,
          text,
          media,
          mediaContentType,
          mediaDuration: resolvedDuration,
          mediaIsShort,
        }),
        type: QueueType.MESSAGE,
        discordGuildId: interaction.guildId!,
        duration: resolvedDuration,
        discordReceivedAt: new Date(discordReceivedAt),
        processingMs,
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

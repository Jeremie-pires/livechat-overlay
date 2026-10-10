import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { measureContentProcessing, ContentInfo } from '../../services/telemetry';
import { getDurationFromGuildId } from '../../services/utils';
import { getAudioInfoFromUrl } from '../../services/content-utils';
import { replyError, validateInputs, parseCustomDuration, computeFinalDuration } from './commandHelpers';

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
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionAudio')!)
        .setDescription(rosetty.t('hideSendCommandOptionAudioDescription')!)
        .setRequired(false),
    ),
  handler: async (interaction: ChatInputCommandInteraction) => {
    const discordReceivedAt = interaction.createdTimestamp;
    await interaction.deferReply({ ephemeral: true });

    const mediaKey = rosetty.t('hideSendCommandOptionMedia')!;
    const url = interaction.options.get(rosetty.t('hideSendCommandOptionURL')!)?.value as string | undefined;
    const text = interaction.options.get(rosetty.t('hideSendCommandOptionText')!)?.value as string | undefined;
    const media = interaction.options.get(mediaKey)?.attachment?.proxyURL;
    const audio = interaction.options.get(rosetty.t('hideSendCommandOptionAudio')!)?.value as string | undefined;
    const customDurationString = interaction.options.get(rosetty.t('hideSendCommandOptionDuration')!)?.value as
      | string
      | undefined;
    let mediaContentType = interaction.options.get(mediaKey)?.attachment?.contentType;
    let mediaDuration = interaction.options.get(mediaKey)?.attachment?.duration;
    let mediaIsShort = false;

    const validationError = validateInputs(url, media, text, audio);
    if (validationError) {
      await replyError(interaction, validationError);
      return;
    }

    const { finalDuration: customFinalDuration, error: durationError } = parseCustomDuration(
      customDurationString,
      mediaDuration,
    );
    if (durationError) {
      await replyError(interaction, 'invalidDuration');
      return;
    }

    let processingMs = 0;
    let additionalContent: ContentInfo | undefined;

    const [contentResult, resolvedAudio] = await Promise.all([
      (!mediaContentType || !mediaDuration) && (media || url)
        ? measureContentProcessing((media ?? url) as string)
        : Promise.resolve(null),
      audio ? getAudioInfoFromUrl(audio) : Promise.resolve(null),
    ]);

    if (audio && !resolvedAudio) {
      await replyError(interaction, 'invalidAudioUrl');
      return;
    }

    const audioInfo = resolvedAudio;

    if (contentResult) {
      processingMs = contentResult.processingMs;
      additionalContent = contentResult.contentInfo;
    }

    mediaContentType = mediaContentType ?? additionalContent?.contentType;

    if (mediaContentType?.startsWith('video/')) {
      mediaIsShort = detectShortFromAttachment(interaction, mediaKey);
    }

    mediaDuration = mediaDuration ?? additionalContent?.mediaDuration;
    mediaIsShort = additionalContent?.mediaIsShort ?? mediaIsShort;

    const finalDuration = computeFinalDuration(customFinalDuration, mediaDuration, mediaContentType, audioInfo);

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
          ...(audioInfo ? { audioUrl: audioInfo.audioUrl, audioDuration: audioInfo.audioDuration } : {}),
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

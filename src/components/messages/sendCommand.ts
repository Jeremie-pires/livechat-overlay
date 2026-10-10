import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { measureContentProcessing, ContentInfo } from '../../services/telemetry';
import { getDurationFromGuildId } from '../../services/utils';
import { getAudioInfoFromUrl, AudioInfo } from '../../services/content-utils';
import { replyError, validateInputs, parseCustomDuration, computeFinalDuration } from './commandHelpers';

export const sendCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('sendCommand')!)
    .setDescription(rosetty.t('sendCommandDescription')!)
    .addStringOption((option) =>
      option.setName(rosetty.t('sendCommandOptionURL')!).setDescription(rosetty.t('sendCommandOptionURLDescription')!),
    )
    .addAttachmentOption((option) =>
      option
        .setName(rosetty.t('sendCommandOptionMedia')!)
        .setDescription(rosetty.t('sendCommandOptionMediaDescription')!),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('sendCommandOptionText')!)
        .setDescription(rosetty.t('sendCommandOptionTextDescription')!)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('sendCommandOptionDuration')!)
        .setDescription(rosetty.t('sendCommandOptionDurationDescription')!)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('sendCommandOptionAudio')!)
        .setDescription(rosetty.t('sendCommandOptionAudioDescription')!)
        .setRequired(false),
    ),
  handler: async (interaction: ChatInputCommandInteraction) => {
    const discordReceivedAt = interaction.createdTimestamp;
    await interaction.deferReply();

    const url = interaction.options.get(rosetty.t('sendCommandOptionURL')!)?.value as string | undefined;
    const text = interaction.options.get(rosetty.t('sendCommandOptionText')!)?.value as string | undefined;
    const media = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.proxyURL;
    const audio = interaction.options.get(rosetty.t('sendCommandOptionAudio')!)?.value as string | undefined;
    const customDurationString = interaction.options.get(rosetty.t('sendCommandOptionDuration')!)?.value as
      | string
      | undefined;
    let mediaContentType = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.contentType;
    let mediaDuration = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.duration;
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
        ? measureContentProcessing((media || url) as string)
        : Promise.resolve(null),
      audio ? getAudioInfoFromUrl(audio) : Promise.resolve(null),
    ]);

    if (audio && !resolvedAudio) {
      await replyError(interaction, 'invalidAudioUrl');
      return;
    }

    const audioInfo: AudioInfo | null = resolvedAudio;

    if (contentResult) {
      processingMs = contentResult.processingMs;
      additionalContent = contentResult.contentInfo;
    }

    mediaContentType = mediaContentType ?? additionalContent?.contentType;
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
        author: interaction.user.username,
        authorImage: interaction.user.avatarURL(),
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
          .setDescription(rosetty.t('sendCommandAnswer')!)
          .setColor(0x2ecc71),
      ],
    });
  },
});

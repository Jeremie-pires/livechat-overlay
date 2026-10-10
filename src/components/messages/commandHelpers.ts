import { ChatInputCommandInteraction, EmbedBuilder, InteractionResponse, Message } from 'discord.js';
import { measureContentProcessing, ContentInfo } from '../../services/telemetry';
import { AudioInfo, getAudioInfoFromUrl } from '../../services/content-utils';
import { I18nKey } from '../../services/i18n/loader';
import { getDurationFromGuildId, parseDuration } from '../../services/utils';
import { QueueType } from '../../services/prisma/loadPrisma';

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function replyError(interaction: ChatInputCommandInteraction, descriptionKey: I18nKey): Promise<void> {
  await interaction.editReply({
    embeds: [
      new EmbedBuilder().setTitle(rosetty.t('error')!).setDescription(rosetty.t(descriptionKey)!).setColor(0xe74c3c),
    ],
  });
}

export function validateInputs(
  url: string | undefined,
  media: string | undefined,
  text: string | undefined,
  audio: string | undefined,
): I18nKey | null {
  if (!url && !media && !text && !audio) return 'noContentProvided';
  if (url && !isValidUrl(url)) return 'invalidUrl';
  if (audio && !isValidUrl(audio)) return 'invalidAudioUrl';
  return null;
}

export function parseCustomDuration(
  customDurationString: string | undefined,
  mediaDuration: number | null | undefined,
): { finalDuration: number | undefined; error: boolean } {
  if (!customDurationString) return { finalDuration: undefined, error: false };
  const result = parseDuration(customDurationString.trim().toLowerCase(), mediaDuration);
  if (result === 'error') return { finalDuration: undefined, error: true };
  return { finalDuration: result, error: false };
}

export function computeFinalDuration(
  customFinalDuration: number | undefined,
  mediaDuration: number | null | undefined,
  mediaContentType: string | null | undefined,
  audioInfo: AudioInfo | null,
): number | undefined {
  if (customFinalDuration !== undefined) return customFinalDuration;
  const isVideo = mediaContentType?.startsWith('video/') || mediaContentType?.startsWith('audio/');
  if (isVideo && mediaDuration) return Math.ceil(mediaDuration);
  if (audioInfo?.audioDuration) return Math.ceil(audioInfo.audioDuration);
  return undefined;
}

export interface MessageOptionKeys {
  url: I18nKey;
  text: I18nKey;
  media: I18nKey;
  audio: I18nKey;
  duration: I18nKey;
}

export interface MessageHandlerConfig {
  optionKeys: MessageOptionKeys;
  ephemeral?: boolean;
  detectShortVideo?: boolean;
  withAuthor?: boolean;
  successKey: I18nKey;
}

export async function executeMessageHandler(
  interaction: ChatInputCommandInteraction,
  config: MessageHandlerConfig,
): Promise<void> {
  const { optionKeys, ephemeral, detectShortVideo, withAuthor, successKey } = config;
  const discordReceivedAt = interaction.createdTimestamp;
  await interaction.deferReply(ephemeral ? { ephemeral: true } : undefined);

  const mediaKey = rosetty.t(optionKeys.media)!;
  const url = interaction.options.get(rosetty.t(optionKeys.url)!)?.value as string | undefined;
  const text = interaction.options.get(rosetty.t(optionKeys.text)!)?.value as string | undefined;
  const media = interaction.options.get(mediaKey)?.attachment?.proxyURL;
  const audio = interaction.options.get(rosetty.t(optionKeys.audio)!)?.value as string | undefined;
  const customDurationString = interaction.options.get(rosetty.t(optionKeys.duration)!)?.value as string | undefined;
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

  const audioInfo: AudioInfo | null = resolvedAudio;

  if (contentResult) {
    processingMs = contentResult.processingMs;
    additionalContent = contentResult.contentInfo;
  }

  mediaContentType = mediaContentType ?? additionalContent?.contentType;

  if (detectShortVideo && mediaContentType?.startsWith('video/')) {
    const height = interaction.options.get(mediaKey)?.attachment?.height;
    const width = interaction.options.get(mediaKey)?.attachment?.width;
    mediaIsShort = !!(height && width && height > width);
  }

  mediaDuration = mediaDuration ?? additionalContent?.mediaDuration;
  mediaIsShort = additionalContent?.mediaIsShort ?? mediaIsShort;

  const finalDuration = computeFinalDuration(customFinalDuration, mediaDuration, mediaContentType, audioInfo);
  const resolvedDuration = await getDurationFromGuildId(
    finalDuration !== undefined ? Math.ceil(finalDuration) : undefined,
    interaction.guildId!,
  );

  const authorData = withAuthor ? { author: interaction.user.username, authorImage: interaction.user.avatarURL() } : {};

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
      ...authorData,
      discordGuildId: interaction.guildId!,
      duration: resolvedDuration,
      discordReceivedAt: new Date(discordReceivedAt),
      processingMs,
    },
  });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder().setTitle(rosetty.t('success')!).setDescription(rosetty.t(successKey)!).setColor(0x2ecc71),
    ],
  });
}

interface TalkQueueConfig {
  text: unknown;
  media: string;
  additionalContent: ContentInfo;
  discordReceivedAt: number;
  processingMs: number;
  withAuthor?: boolean;
}

export async function resolveTTSAttachment(
  interaction: ChatInputCommandInteraction,
  reply: Message | InteractionResponse,
): Promise<{ media: string; processingMs: number; additionalContent: ContentInfo } | null> {
  const message = await reply.fetch();
  const media = message.attachments.first()?.proxyURL;
  if (!media) {
    await replyError(interaction, 'talkNoAttachment');
    return null;
  }
  const { processingMs, contentInfo: additionalContent } = await measureContentProcessing(media);
  return { media, processingMs, additionalContent };
}

export async function createTalkQueueEntry(
  interaction: ChatInputCommandInteraction,
  { text, media, additionalContent, discordReceivedAt, processingMs, withAuthor }: TalkQueueConfig,
): Promise<void> {
  const authorData = withAuthor ? { author: interaction.user.username, authorImage: interaction.user.avatarURL() } : {};

  await prisma.queue.create({
    data: {
      content: JSON.stringify({
        text,
        media,
        mediaContentType: 'audio/mpeg',
        mediaDuration: Math.ceil((additionalContent.mediaDuration ?? 0) as number),
      }),
      type: QueueType.VOCAL,
      discordGuildId: interaction.guildId!,
      duration: await getDurationFromGuildId(
        additionalContent.mediaDuration ? Math.ceil(additionalContent.mediaDuration as number) : undefined,
        interaction.guildId!,
      ),
      ...authorData,
      discordReceivedAt: new Date(discordReceivedAt),
      processingMs,
    },
  });
}

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { AudioInfo } from '../../services/content-utils';
import { I18nKey } from '../../services/i18n/loader';
import { parseDuration } from '../../services/utils';

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
      new EmbedBuilder()
        .setTitle(rosetty.t('error')!)
        .setDescription(rosetty.t(descriptionKey)!)
        .setColor(0xe74c3c),
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

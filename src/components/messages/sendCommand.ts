import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { measureContentProcessing, ContentInfo } from '../../services/telemetry';
import { getDurationFromGuildId, parseDuration } from '../../services/utils';
import { getAudioInfoFromUrl, AudioInfo } from '../../services/content-utils';

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

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

    if (!url && !media && !text && !audio) {
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

    if (audio && !isValidUrl(audio)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('invalidAudioUrl')!)
            .setColor(0xe74c3c),
        ],
      });
      return;
    }

    let finalDuration: number | undefined = undefined;

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
    let audioInfo: AudioInfo | null = null;

    const [contentResult, resolvedAudio] = await Promise.all([
      (!mediaContentType || !mediaDuration) && (media || url)
        ? measureContentProcessing((media || url) as string)
        : Promise.resolve(null),
      audio ? getAudioInfoFromUrl(audio) : Promise.resolve(null),
    ]);

    if (contentResult) {
      processingMs = contentResult.processingMs;
      additionalContent = contentResult.contentInfo;
    }

    if (audio && !resolvedAudio) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('invalidAudioUrl')!)
            .setColor(0xe74c3c),
        ],
      });
      return;
    }
    audioInfo = resolvedAudio;

    if ((mediaContentType === undefined || mediaContentType === null) && additionalContent?.contentType) {
      mediaContentType = additionalContent.contentType;
    }

    if ((mediaDuration === undefined || mediaDuration === null) && additionalContent?.mediaDuration) {
      mediaDuration = additionalContent.mediaDuration;
    }

    if (additionalContent?.mediaIsShort) {
      mediaIsShort = additionalContent.mediaIsShort;
    }

    const isVideo = mediaContentType?.startsWith('video/') || mediaContentType?.startsWith('audio/');

    if (finalDuration === undefined && isVideo && mediaDuration) {
      finalDuration = Math.ceil(mediaDuration);
    }

    if (finalDuration === undefined && audioInfo?.audioDuration) {
      finalDuration = Math.ceil(audioInfo.audioDuration);
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

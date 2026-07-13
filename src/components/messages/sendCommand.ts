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
    ),
  handler: async (interaction: ChatInputCommandInteraction) => {
    const discordReceivedAt = interaction.createdTimestamp;
    await interaction.deferReply();

    const url = interaction.options.get(rosetty.t('sendCommandOptionURL')!)?.value as string | undefined;
    const text = interaction.options.get(rosetty.t('sendCommandOptionText')!)?.value as string | undefined;
    const media = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.proxyURL;
    const customDurationString = interaction.options.get(rosetty.t('sendCommandOptionDuration')!)?.value as
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

    let processingMs = 0;
    let additionalContent: ContentInfo | undefined;
    if ((!mediaContentType || !mediaDuration) && (media || url)) {
      const result = await measureContentProcessing((media || url) as string);
      processingMs = result.processingMs;
      additionalContent = result.contentInfo;
    }

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

    if (finalDuration === undefined && isVideo) {
      finalDuration = mediaDuration ? Math.ceil(mediaDuration) : 0;
    }

    const resolvedDuration = await getDurationFromGuildId(
      finalDuration !== undefined ? Math.ceil(finalDuration) : undefined,
      interaction.guildId!,
    );
    await prisma.queue.create({
      data: {
        content: JSON.stringify({
          url,
          text,
          media,
          mediaContentType,
          mediaDuration: resolvedDuration,
          mediaIsShort,
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

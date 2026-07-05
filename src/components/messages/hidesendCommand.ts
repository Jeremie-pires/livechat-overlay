import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../services/utils';

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
    const url = interaction.options.get(rosetty.t('hideSendCommandOptionURL')!)?.value;
    const text = interaction.options.get(rosetty.t('hideSendCommandOptionText')!)?.value;
    const media = interaction.options.get(rosetty.t('hideSendCommandOptionMedia')!)?.attachment?.proxyURL;
    const customDurationString = interaction.options.get(rosetty.t('hideSendCommandOptionDuration')!)?.value as string | undefined;
    let mediaContentType = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.contentType;
    let mediaDuration = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.duration;
    let mediaIsShort = false;

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

    let finalDuration: number | undefined = undefined;
    const isVideo = mediaContentType?.startsWith('video/') || mediaContentType?.startsWith('audio/');

    if (customDurationString) {
      const trimmed = customDurationString.trim().toLowerCase();
      if (trimmed === 'full') {
        finalDuration = mediaDuration ? Math.ceil(mediaDuration) : 0;
      } else {
        const parsed = parseInt(trimmed, 10);
        if (!isNaN(parsed) && parsed > 0) {
          finalDuration = parsed;
        }
      }
    }

    if (finalDuration === undefined) {
      if (isVideo) {
        finalDuration = mediaDuration ? Math.ceil(mediaDuration) : 0;
      }
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
          displayFull: await getDisplayMediaFullFromGuildId(interaction.guildId!),
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

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(rosetty.t('success')!)
          .setDescription(rosetty.t('hideSendCommandAnswer')!)
          .setColor(0x2ecc71),
      ],
      ephemeral: true,
    });
  },
});

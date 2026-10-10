import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { measureContentProcessing } from '../../services/telemetry';
import { deleteGtts, promisedGtts, readGttsAsStream } from '../../services/gtts';
import { createTalkQueueEntry } from './commandHelpers';

const MAX_TTS_LENGTH = 200;

export const talkCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('talkCommand')!)
    .setDescription(rosetty.t('talkCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName(rosetty.t('talkCommandOptionVoice')!)
        .setDescription(rosetty.t('talkCommandOptionVoiceDescription')!)
        .setRequired(true)
        .setMaxLength(MAX_TTS_LENGTH),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('talkCommandOptionText')!)
        .setDescription(rosetty.t('talkCommandOptionTextDescription')!),
    ),
  handler: async (interaction: ChatInputCommandInteraction) => {
    const discordReceivedAt = interaction.createdTimestamp;
    await interaction.deferReply();

    const voice = interaction.options.get(rosetty.t('talkCommandOptionVoice')!)?.value as string;
    const text = interaction.options.get(rosetty.t('talkCommandOptionText')!)?.value;

    if (!voice.trim() || voice.length > MAX_TTS_LENGTH) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('ttsTextTooLong')!)
            .setColor(0xe74c3c),
        ],
      });
      return;
    }

    const filePath = await promisedGtts(voice, rosetty.getCurrentLang());
    try {
      const fileStream = readGttsAsStream(filePath);

      const interactionReply = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('success')!)
            .setDescription(rosetty.t('talkCommandAnswer')!)
            .setColor(0x2ecc71),
        ],
        files: [fileStream],
      });

      const message = await interactionReply.fetch();
      const media = message.attachments.first()?.proxyURL;

      if (!media) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(rosetty.t('error')!)
              .setDescription(rosetty.t('talkNoAttachment')!)
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      const { processingMs, contentInfo: additionalContent } = await measureContentProcessing(media);

      await createTalkQueueEntry(interaction, {
        text,
        media,
        additionalContent,
        discordReceivedAt,
        processingMs,
        withAuthor: true,
      });
    } finally {
      await deleteGtts(filePath).catch((err) => logger.warn(err, '[TTS] Failed to delete temp file'));
    }
  },
});

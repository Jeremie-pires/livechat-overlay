import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { measureContentProcessing } from '../../services/telemetry';
import { deleteGtts, promisedGtts, readGttsAsStream } from '../../services/gtts';
import { createTalkQueueEntry } from './commandHelpers';

const MAX_TTS_LENGTH = 200;

export const hideTalkCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('hideTalkCommand')!)
    .setDescription(rosetty.t('hideTalkCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideTalkCommandOptionVoice')!)
        .setDescription(rosetty.t('hideTalkCommandOptionVoiceDescription')!)
        .setRequired(true)
        .setMaxLength(MAX_TTS_LENGTH),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideTalkCommandOptionText')!)
        .setDescription(rosetty.t('hideTalkCommandOptionTextDescription')!),
    ),
  handler: async (interaction: ChatInputCommandInteraction) => {
    const discordReceivedAt = interaction.createdTimestamp;
    const voice = interaction.options.get(rosetty.t('hideTalkCommandOptionVoice')!)?.value as string;
    const text = interaction.options.get(rosetty.t('hideTalkCommandOptionText')!)?.value;

    if (!voice.trim() || voice.length > MAX_TTS_LENGTH) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('error')!)
            .setDescription(rosetty.t('ttsTextTooLong')!)
            .setColor(0xe74c3c),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const filePath = await promisedGtts(voice, rosetty.getCurrentLang());
    try {
      const fileStream = readGttsAsStream(filePath);

      const interactionReply = await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('success')!)
            .setDescription(rosetty.t('hideTalkCommandAnswer')!)
            .setColor(0x2ecc71),
        ],
        files: [fileStream],
        flags: MessageFlags.Ephemeral,
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

      await createTalkQueueEntry(interaction, { text, media, additionalContent, discordReceivedAt, processingMs });
    } finally {
      await deleteGtts(filePath).catch((err) => logger.warn(err, '[TTS] Failed to delete temp file'));
    }
  },
});

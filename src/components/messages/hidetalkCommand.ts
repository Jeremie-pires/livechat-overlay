import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { deleteGtts, promisedGtts, readGttsAsStream } from '../../services/gtts';
import { createTalkQueueEntry, resolveTTSAttachment } from './commandHelpers';

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
    const text = interaction.options.get(rosetty.t('hideTalkCommandOptionText')!)?.value as string | undefined;

    await interaction.deferReply({ ephemeral: true });

    if (!voice.trim()) {
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

    const filePath = await promisedGtts(voice, rosetty.getCurrentLang() as string);
    try {
      const fileStream = readGttsAsStream(filePath);

      const interactionReply = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('success')!)
            .setDescription(rosetty.t('hideTalkCommandAnswer')!)
            .setColor(0x2ecc71),
        ],
        files: [fileStream],
      });

      const resolved = await resolveTTSAttachment(interaction, interactionReply);
      if (!resolved) return;
      const { media, processingMs, additionalContent } = resolved;

      await createTalkQueueEntry(interaction, { text, media, additionalContent, discordReceivedAt, processingMs });
    } finally {
      await deleteGtts(filePath).catch((err) => logger.warn(err, '[TTS] Failed to delete temp file'));
    }
  },
});

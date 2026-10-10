import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { executeMessageHandler } from './commandHelpers';

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
    await executeMessageHandler(interaction, {
      optionKeys: {
        url: 'hideSendCommandOptionURL',
        text: 'hideSendCommandOptionText',
        media: 'hideSendCommandOptionMedia',
        audio: 'hideSendCommandOptionAudio',
        duration: 'hideSendCommandOptionDuration',
      },
      ephemeral: true,
      detectShortVideo: true,
      successKey: 'hideSendCommandAnswer',
    });
  },
});

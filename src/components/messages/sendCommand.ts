import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { executeMessageHandler } from './commandHelpers';

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
    await executeMessageHandler(interaction, {
      optionKeys: {
        url: 'sendCommandOptionURL',
        text: 'sendCommandOptionText',
        media: 'sendCommandOptionMedia',
        audio: 'sendCommandOptionAudio',
        duration: 'sendCommandOptionDuration',
      },
      withAuthor: true,
      successKey: 'sendCommandAnswer',
    });
  },
});

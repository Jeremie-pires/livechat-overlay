import { ChatInputCommandInteraction } from 'discord.js';
import { buildMessageCommandData, executeMessageHandler } from './commandHelpers';

export const hideSendCommand = () => ({
  data: buildMessageCommandData('hideSendCommand'),
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

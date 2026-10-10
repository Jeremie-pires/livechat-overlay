import { ChatInputCommandInteraction } from 'discord.js';
import { buildMessageCommandData, executeMessageHandler } from './commandHelpers';

export const sendCommand = () => ({
  data: buildMessageCommandData('sendCommand'),
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

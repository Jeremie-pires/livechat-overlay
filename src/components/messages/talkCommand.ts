import { ChatInputCommandInteraction } from 'discord.js';
import { buildTalkCommandData, executeTalkHandler } from './commandHelpers';

export const talkCommand = () => ({
  data: buildTalkCommandData('talkCommand'),
  handler: async (interaction: ChatInputCommandInteraction) => {
    await executeTalkHandler(interaction, { prefix: 'talkCommand', withAuthor: true });
  },
});

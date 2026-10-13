import { ChatInputCommandInteraction } from 'discord.js';
import { buildTalkCommandData, executeTalkHandler } from './commandHelpers';

export const hideTalkCommand = () => ({
  data: buildTalkCommandData('hideTalkCommand'),
  handler: async (interaction: ChatInputCommandInteraction) => {
    await executeTalkHandler(interaction, { prefix: 'hideTalkCommand', ephemeral: true });
  },
});

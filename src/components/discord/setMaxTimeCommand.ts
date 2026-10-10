import { createSetGuildTimeCommand } from '../../services/discord-utils';

export const setMaxTimeCommand = () =>
  createSetGuildTimeCommand({
    commandNameKey: 'setMaxTimeCommand',
    commandDescriptionKey: 'setMaxTimeCommandDescription',
    optionNameKey: 'setMaxTimeCommandOptionText',
    optionDescriptionKey: 'setMaxTimeCommandOptionTextDescription',
    persist: async (guildId, value) => {
      await prisma.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, maxMediaTime: value },
        update: { maxMediaTime: value },
      });
    },
    successKey: 'setMaxTimeCommandAnswer',
  });

import { createSetGuildTimeCommand } from '../../services/discord-utils';

export const setDefaultTimeCommand = () =>
  createSetGuildTimeCommand({
    commandNameKey: 'setDefaultTimeCommand',
    commandDescriptionKey: 'setDefaultTimeCommandDescription',
    optionNameKey: 'setDefaultTimeCommandOptionText',
    optionDescriptionKey: 'setDefaultTimeCommandOptionTextDescription',
    persist: async (guildId, value) => {
      await prisma.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, defaultMediaTime: value },
        update: { defaultMediaTime: value },
      });
    },
    successKey: 'setDefaultTimeCommandAnswer',
  });

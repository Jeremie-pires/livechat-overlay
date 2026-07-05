export const getDurationFromGuildId = async (duration: number | undefined | null, guildId: string) => {
  const guild = await prisma.guild.findFirst({
    where: {
      id: guildId,
    },
  });

  return duration ?? guild?.defaultMediaTime ?? env.DEFAULT_DURATION;
};

export const getDisplayMediaFullFromGuildId = async (guildId: string) => {
  const guild = await prisma.guild.findFirst({
    where: {
      id: guildId,
    },
  });

  return !!guild?.displayMediaFull || false;
};

export const getDurationFromGuildId = async (duration: number | undefined | null, guildId: string) => {
  const guild = await prisma.guild.findFirst({
    where: { id: guildId },
    select: { defaultMediaTime: true },
  });

  return duration ?? guild?.defaultMediaTime ?? env.DEFAULT_DURATION;
};

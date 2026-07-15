const MAX_DURATION_SECONDS = 3600;

export function parseDuration(trimmed: string, mediaDuration: number | null | undefined): number | 'error' {
  if (trimmed === 'full') {
    return mediaDuration ? Math.ceil(mediaDuration) : 0;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_DURATION_SECONDS) {
    return 'error';
  }
  return parsed;
}

export const getDurationFromGuildId = async (duration: number | undefined | null, guildId: string) => {
  const guild = await prisma.guild.findFirst({
    where: { id: guildId },
    select: { defaultMediaTime: true },
  });

  return duration ?? guild?.defaultMediaTime ?? env.DEFAULT_DURATION;
};

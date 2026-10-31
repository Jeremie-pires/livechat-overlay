const MAX_DURATION_SECONDS = 3600;

export const isRateLimitExempt = (req: { url?: string }): boolean => {
  const url = req.url ?? '';
  return url.startsWith('/socket.io') || url.startsWith('/health') || url.startsWith('/client/');
};

export function parseDuration(trimmed: string, mediaDuration: number | null | undefined): number | 'error' {
  if (trimmed === 'full') {
    // Capped like explicit values: the client never plays past MAX_DURATION_SECONDS anyway.
    return mediaDuration ? Math.min(Math.ceil(mediaDuration), MAX_DURATION_SECONDS) : 'error';
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

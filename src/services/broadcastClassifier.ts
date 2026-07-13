import { randomUUID } from 'crypto';

export type BroadcastStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface BroadcastResult {
  guildId: string;
  channelId: string | null;
  status: BroadcastStatus;
  errorCode?: string;
  errorReason?: string;
}

const DISCORD_ERROR_MAP: Record<string, string> = {
  '50001': 'Missing Access',
  '10003': 'Unknown Channel',
  '50013': 'Missing Permissions',
  '50007': 'Cannot Send Messages',
};

const truncate = (s: string, max = 100): string => (s.length > max ? s.slice(0, max) + '…' : s);

export const classifyDiscordError = (err: unknown): { errorCode: string; errorReason: string } => {
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    const knownReason = DISCORD_ERROR_MAP[code];
    if (knownReason) return { errorCode: code, errorReason: knownReason };
    const msg = 'message' in err ? String((err as { message: unknown }).message) : '';
    return { errorCode: code, errorReason: truncate(msg) };
  }
  return { errorCode: 'UNKNOWN', errorReason: String(err) };
};

export const mintRunId = (): string => randomUUID();

export const persistBroadcastRun = async (runId: string, results: BroadcastResult[]): Promise<void> => {
  if (results.length === 0) return;
  await prisma.broadcastLog.createMany({
    data: results.map((r) => ({
      runId,
      guildId: r.guildId,
      channelId: r.channelId ?? null,
      status: r.status,
      errorCode: r.errorCode ?? null,
      errorReason: r.errorReason ?? null,
    })),
  });
};

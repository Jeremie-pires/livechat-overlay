import { addMilliseconds, addSeconds } from 'date-fns';
import { env } from '../../services/env';
import { QueueType } from '../../services/prisma/loadPrisma';

const MESSAGE_SYNC_LEAD_TIME_MS = 1200;
const REQUEUE_INTERVAL_MS = 250;
const MAX_MEDIA_DURATION_S = 3600;

export function resolveMediaDurationMs(mediaDuration: unknown): number {
  const rawDuration = Number(mediaDuration);
  const finiteDuration = Number.isFinite(rawDuration) ? rawDuration : 0;
  const seconds = Math.min(Math.max(finiteDuration, 0), MAX_MEDIA_DURATION_S);
  return seconds * 1000 || 5000;
}

type MediaType = 'image' | 'video' | 'audio' | 'link' | 'text';

const getMediaType = (type: string, content: { url?: string; mediaContentType?: string }): MediaType => {
  if (type === QueueType.VOCAL || content.mediaContentType?.startsWith('audio/')) return 'audio';
  if (content.mediaContentType?.startsWith('video/')) return 'video';
  if (content.mediaContentType?.startsWith('image/')) return 'image';
  if (content.url) return 'link';
  return 'text';
};

export const executeMessagesWorker = async (fastify: FastifyCustomInstance) => {
  const candidate = await prisma.queue.findFirst({
    where: {
      executionDate: {
        lte: new Date(),
      },
    },
    orderBy: {
      executionDate: 'asc',
    },
  });

  if (candidate === null) {
    logger.debug(`[SOCKET] No new message`);
    return;
  }

  const busyGuild = await prisma.guild.findFirst({
    where: {
      id: candidate.discordGuildId,
      busyUntil: {
        gte: new Date(),
      },
    },
  });

  if (busyGuild) {
    await prisma.queue.update({
      where: { id: candidate.id },
      data: {
        executionDate: addMilliseconds(new Date(), REQUEUE_INTERVAL_MS),
        busyRequeueMs: { increment: REQUEUE_INTERVAL_MS },
      },
    });
    return;
  }

  // Atomic claim: delete the row first, then set guild busy.
  // deleteMany returns count=0 if another concurrent tick already claimed this row,
  // ensuring exactly-once emit under SQLite's serialized write model.
  const lastMessage = await prisma.$transaction(async (tx) => {
    const { count } = await tx.queue.deleteMany({ where: { id: candidate.id } });
    if (count === 0) return null;

    let busyUntil = addSeconds(new Date(), candidate.duration);
    busyUntil = addMilliseconds(busyUntil, REQUEUE_INTERVAL_MS + MESSAGE_SYNC_LEAD_TIME_MS);

    await tx.guild.upsert({
      where: { id: candidate.discordGuildId },
      create: { id: candidate.discordGuildId, busyUntil },
      update: { busyUntil },
    });

    return candidate;
  });

  if (lastMessage === null) return;

  let content: Record<string, unknown>;
  try {
    content = JSON.parse(lastMessage.content);
  } catch {
    logger.error(`[WORKER] Malformed JSON for message ${lastMessage.id} — discarding`);
    return;
  }

  const dequeuedAt = Date.now();

  fastify.io.to(`${env.APP_ENV}:messages-${lastMessage.discordGuildId}`).emit('new-message', {
    ...lastMessage,
    displayAt: dequeuedAt + MESSAGE_SYNC_LEAD_TIME_MS,
  });
  logger.debug(`[SOCKET] New message ${lastMessage.id} (guild: ${lastMessage.discordGuildId}): ${lastMessage.content}`);

  const emittedAt = Date.now();

  const enqueuedAt = lastMessage.submissionDate.getTime();
  const busyRequeueMs = lastMessage.busyRequeueMs;

  const ingestionMs = lastMessage.discordReceivedAt
    ? Math.max(0, enqueuedAt - lastMessage.discordReceivedAt.getTime() - (lastMessage.processingMs ?? 0))
    : 0;
  const processingMs = lastMessage.processingMs ?? 0;
  const queueWaitMs = Math.max(0, dequeuedAt - enqueuedAt - busyRequeueMs);
  const emitMs = Math.max(0, emittedAt - dequeuedAt);
  const backpressureMs = busyRequeueMs;
  const totalMs = ingestionMs + processingMs + queueWaitMs + emitMs;

  if (ingestionMs === 0 && lastMessage.discordReceivedAt === null) {
    logger.debug(`[WORKER] message ${lastMessage.id} missing discordReceivedAt — ingestionMs reported as 0`);
  }

  const payloadBytes = Buffer.byteLength(lastMessage.content, 'utf8');
  const mediaType = getMediaType(lastMessage.type, content);
  const countField = `${mediaType}Count` as const;

  await Promise.all([
    prisma.stats.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        totalSent: 1,
        [countField]: 1,
        totalLatencyMs: totalMs,
        latencyCount: 1,
        totalPayloadBytes: payloadBytes,
        totalIngestionMs: ingestionMs,
        ingestionCount: 1,
        totalQueueWaitMs: queueWaitMs,
        queueWaitCount: 1,
        totalProcessingMs: processingMs,
        processingCount: 1,
        totalEmitMs: emitMs,
        emitCount: 1,
        totalBackpressureMs: backpressureMs,
      },
      update: {
        totalSent: { increment: 1 },
        [countField]: { increment: 1 },
        totalLatencyMs: { increment: totalMs },
        latencyCount: { increment: 1 },
        totalPayloadBytes: { increment: payloadBytes },
        totalIngestionMs: { increment: ingestionMs },
        ingestionCount: { increment: 1 },
        totalQueueWaitMs: { increment: queueWaitMs },
        queueWaitCount: { increment: 1 },
        totalProcessingMs: { increment: processingMs },
        processingCount: { increment: 1 },
        totalEmitMs: { increment: emitMs },
        emitCount: { increment: 1 },
        totalBackpressureMs: { increment: backpressureMs },
      },
    }),
    prisma.latencySample.create({
      data: {
        latencyMs: totalMs,
        ingestionMs,
        queueWaitMs,
        processingMs,
        emitMs,
        backpressureMs,
        totalMs,
      },
    }),
  ]);

  return resolveMediaDurationMs(content.mediaDuration);
};

//INFO : Optimization - Can be executed into a dedicated worker ?
export const loadMessagesWorker = async (fastify: FastifyCustomInstance) => {
  try {
    await executeMessagesWorker(fastify);
  } catch (error) {
    logger.error(error, '[WORKER] executeMessagesWorker failed — skipping tick');
  }

  setTimeout(() => {
    loadMessagesWorker(fastify);
  }, 100);
};

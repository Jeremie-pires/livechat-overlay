import { addMilliseconds, addSeconds } from 'date-fns';
import { QueueType } from '../../services/prisma/loadPrisma';

const MESSAGE_SYNC_LEAD_TIME_MS = 1200;

type MediaType = 'image' | 'video' | 'audio' | 'link' | 'text';

const getMediaType = (type: string, content: { url?: string; mediaContentType?: string }): MediaType => {
  if (type === QueueType.VOCAL || content.mediaContentType?.startsWith('audio/')) return 'audio';
  if (content.mediaContentType?.startsWith('video/')) return 'video';
  if (content.mediaContentType?.startsWith('image/')) return 'image';
  if (content.url) return 'link';
  return 'text';
};

export const executeMessagesWorker = async (fastify: FastifyCustomInstance) => {
  //Get last message
  const lastMessage = await prisma.queue.findFirst({
    where: {
      executionDate: {
        lte: new Date(),
      },
    },
    orderBy: {
      executionDate: 'asc',
    },
  });

  if (lastMessage === null) {
    logger.debug(`[SOCKET] No new message`);
    return;
  }

  //Check if queue is playing
  const guild = await prisma.guild.findFirst({
    where: {
      id: lastMessage.discordGuildId,
      busyUntil: {
        gte: new Date(),
      },
    },
  });

  if (guild) {
    await prisma.queue.update({
      where: {
        id: lastMessage.id,
      },
      data: {
        executionDate: addMilliseconds(new Date(), 250),
      },
    });
    return;
  } else {
    let busyUntil = addSeconds(new Date(), lastMessage.duration);

    //Safety mesure
    busyUntil = addMilliseconds(busyUntil, 250 + MESSAGE_SYNC_LEAD_TIME_MS);

    await prisma.guild.upsert({
      where: {
        id: lastMessage.discordGuildId,
      },
      create: {
        id: lastMessage.discordGuildId,
        busyUntil,
      },
      update: {
        busyUntil,
      },
    });
  }

  fastify.io.to(`messages-${lastMessage.discordGuildId}`).emit('new-message', {
    ...lastMessage,
    displayAt: Date.now() + MESSAGE_SYNC_LEAD_TIME_MS,
  });
  logger.debug(`[SOCKET] New message ${lastMessage.id} (guild: ${lastMessage.discordGuildId}): ${lastMessage.content}`);

  await prisma.queue.delete({ where: { id: lastMessage.id } });

  const content = JSON.parse(lastMessage.content);
  const latencyMs = Date.now() - lastMessage.submissionDate.getTime();
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
        totalLatencyMs: latencyMs,
        latencyCount: 1,
        totalPayloadBytes: payloadBytes,
      },
      update: {
        totalSent: { increment: 1 },
        [countField]: { increment: 1 },
        totalLatencyMs: { increment: latencyMs },
        latencyCount: { increment: 1 },
        totalPayloadBytes: { increment: payloadBytes },
      },
    }),
    prisma.latencySample.create({ data: { latencyMs } }),
  ]);

  return content.mediaDuration * 1000 || 5000;
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

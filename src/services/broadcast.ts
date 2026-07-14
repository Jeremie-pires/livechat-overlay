import { EmbedBuilder, TextChannel } from 'discord.js';
import { BroadcastResult, classifyDiscordError, mintRunId, persistBroadcastRun } from './broadcastClassifier';

export const broadcastToAllGuilds = async (
  title: string,
  description: string,
  color: number,
): Promise<BroadcastResult[]> => {
  const guilds = await prisma.guild.findMany({ where: { channelId: { not: null } } });
  const runId = mintRunId();

  const results = await Promise.all(
    guilds.map(async (guild): Promise<BroadcastResult> => {
      const base: BroadcastResult = { guildId: guild.id, channelId: guild.channelId ?? null, status: 'FAILED' };
      try {
        const channel = await discordClient.channels.fetch(guild.channelId!);
        if (!channel?.isTextBased()) {
          return { ...base, errorCode: 'NOT_TEXT', errorReason: 'Channel not text-based or not found' };
        }
        await (channel as TextChannel).send({
          embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(color)],
        });
        return { ...base, status: 'SUCCESS' };
      } catch (err) {
        const { errorCode, errorReason } = classifyDiscordError(err);
        return { ...base, errorCode, errorReason };
      }
    }),
  );

  await persistBroadcastRun(runId, results);
  return results;
};

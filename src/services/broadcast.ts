import { EmbedBuilder, TextChannel } from 'discord.js';

export const broadcastToAllGuilds = async (title: string, description: string, color: number): Promise<void> => {
  try {
    const guilds = await prisma.guild.findMany({ where: { channelId: { not: null } } });
    await Promise.allSettled(
      guilds.map(async (guild) => {
        try {
          const channel = await discordClient.channels.fetch(guild.channelId!);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({
              embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(color)],
            });
          }
        } catch {}
      }),
    );
  } catch {}
};

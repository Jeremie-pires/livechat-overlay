import { EmbedBuilder } from 'discord.js';

export type BotEventType = 'START' | 'STOP' | 'CRASH' | 'ERROR';

const EVENT_COLORS: Record<BotEventType, number> = {
  START: 0x2ecc71,
  STOP: 0xf59e0b,
  CRASH: 0xe74c3c,
  ERROR: 0xe74c3c,
};

const EVENT_TITLES: Record<BotEventType, string> = {
  START: '🟢 Bot démarré',
  STOP: '🟡 Bot arrêté',
  CRASH: '🔴 Crash détecté',
  ERROR: '🟠 Erreur',
};

export const logBotEvent = async (type: BotEventType, message?: string): Promise<void> => {
  if (!global.prisma) return;
  try {
    await global.prisma.botEvent.create({ data: { type, message: message ?? null } });
  } catch {
    // Logging must never crash the process
  }
};

export const notifyOwner = async (type: BotEventType, message?: string): Promise<void> => {
  if (!global.discordClient || !global.env?.DISCORD_OWNER_ID) return;
  try {
    const user = await global.discordClient.users.fetch(global.env.DISCORD_OWNER_ID);
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(EVENT_TITLES[type])
          .setDescription(message ?? null)
          .setColor(EVENT_COLORS[type])
          .setTimestamp(),
      ],
    });
  } catch {
    // DM might be blocked or client not ready — non-fatal
  }
};

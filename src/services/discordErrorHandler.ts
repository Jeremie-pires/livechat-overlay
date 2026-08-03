import { ChatInputCommandInteraction, DiscordAPIError, EmbedBuilder, MessageFlags } from 'discord.js';
import type { enLang } from './i18n/en';

type I18nKey = keyof typeof enLang;

const USER_ERROR_CODES: Partial<Record<number, I18nKey>> = {
  50001: 'errorMissingAccess',
  50013: 'errorMissingPermissions',
  10003: 'errorUnknownChannel',
  10008: 'errorUnknownMessage',
};

// 10062 = Unknown Interaction: the interaction token has expired, replying is not possible
const SILENT_CODES = new Set([10062]);

export const classifyAndReply = async (error: unknown, interaction: ChatInputCommandInteraction): Promise<void> => {
  if (error instanceof DiscordAPIError) {
    const code = error.code as number;

    if (SILENT_CODES.has(code)) {
      logger.warn({ code }, '[DISCORD] Interaction expired before error reply could be sent');
      return;
    }

    const i18nKey = USER_ERROR_CODES[code];
    if (i18nKey) {
      logger.warn({ code, command: interaction.commandName }, `[DISCORD] ${error.message}`);
      await safeReply(interaction, rosetty.t(i18nKey)!);
      return;
    }
  }

  logger.error(error, `[DISCORD] Unhandled error in /${interaction.commandName}`);
  await safeReply(interaction, rosetty.t('commandError')!);
};

const safeReply = async (interaction: ChatInputCommandInteraction, description: string): Promise<void> => {
  try {
    const embed = new EmbedBuilder().setTitle(rosetty.t('error')!).setDescription(description).setColor(0xe74c3c);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  } catch {
    // Interaction token expired — cannot reply
  }
};

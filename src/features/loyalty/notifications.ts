import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { tierByName } from '../../shared/loyalty-config';

import type { GrantXpResult, LevelUpEvent } from './service';

const MIN_XP_TO_NOTIFY = 10;

/** Send the user a DM about an XP gain, throttled by MIN_XP_TO_NOTIFY. */
export async function sendXpGainNotification(
  userId: number,
  result: GrantXpResult,
  source: string,
): Promise<void> {
  if (!result.applied || result.levelUp || Math.abs(result.totalXp) < MIN_XP_TO_NOTIFY) return;
  // Don't double-notify when there's a level-up — the level-up message replaces it.
  try {
    await bot.telegram.sendMessage(
      userId,
      `+${MIN_XP_TO_NOTIFY}+ XP за ${source}. Всего: ${result.totalXp} XP.`,
    );
  } catch (err) {
    logger.debug({ err, userId }, 'sendXpGainNotification failed (probably blocked bot)');
  }
}

export async function sendLevelUpNotification(userId: number, event: LevelUpEvent): Promise<void> {
  try {
    if (event.type === 'tier') {
      const tier = tierByName(event.toTier);
      const emoji = tier?.emoji ?? '';
      const display = tier?.displayName ?? event.toTier;
      await bot.telegram.sendMessage(
        userId,
        `🎉 Новый ранг: ${emoji} <b>${display}</b> (уровень ${event.toLevel})`,
        { parse_mode: 'HTML' },
      );
    } else {
      const tier = tierByName(event.tier);
      const emoji = tier?.emoji ?? '';
      await bot.telegram.sendMessage(userId, `⬆️ Уровень ${event.to} ${emoji}`);
    }
  } catch (err) {
    logger.debug({ err, userId, event }, 'sendLevelUpNotification failed');
  }
}

/** Fire-and-forget convenience wrapper used by feature callers. */
export function dispatchNotifications(userId: number, result: GrantXpResult, source: string): void {
  void (async () => {
    if (result.levelUp) {
      await sendLevelUpNotification(userId, result.levelUp);
    } else {
      await sendXpGainNotification(userId, result, source);
    }
  })();
}

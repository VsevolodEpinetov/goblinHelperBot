import { bot } from '../../core/bot';
import { featureConfig } from '../../core/config';
import { logger } from '../../core/observability';
import { db } from '../../db/client';
import { escapeHtml, formatUserDisplay } from '../../shared/format';
import { tierByName } from '../../shared/loyalty-config';

import { getUserBasic } from './repo';
import type { GrantXpResult, LevelUpEvent } from './service';

const MIN_XP_TO_NOTIFY = 10;

/** The public RPG topic in the main group, when configured. XP gains and
 * level-ups are announced there for everyone (the bragging board the legacy
 * bot had); without it they fall back to private DMs. */
function rpgTopicTarget(): { chatId: string; threadId: number } | null {
  const fc = featureConfig();
  if (!fc.mainGroupId || !fc.rpgTopicId) return null;
  return { chatId: fc.mainGroupId, threadId: fc.rpgTopicId };
}

async function userMention(userId: number): Promise<string> {
  const u = await getUserBasic(db, userId);
  return escapeHtml(
    formatUserDisplay({
      id: userId,
      username: u?.username ?? null,
      firstName: u?.firstName ?? null,
      lastName: u?.lastName ?? null,
    }),
  );
}

/** Post into the RPG topic. Returns false when not configured or the send failed. */
async function announceToRpgTopic(text: string): Promise<boolean> {
  const target = rpgTopicTarget();
  if (!target) return false;
  try {
    await bot.telegram.sendMessage(target.chatId, text, {
      parse_mode: 'HTML',
      message_thread_id: target.threadId,
    });
    return true;
  } catch (err) {
    logger.warn({ err, target }, 'RPG topic announcement failed; falling back to DM');
    return false;
  }
}

/** Announce an XP gain — publicly in the RPG topic when configured, otherwise
 * as a DM. Throttled by MIN_XP_TO_NOTIFY so 1-XP message grants stay quiet. */
export async function sendXpGainNotification(
  userId: number,
  result: GrantXpResult,
  source: string,
): Promise<void> {
  if (!result.applied || result.levelUp || Math.abs(result.gained) < MIN_XP_TO_NOTIFY) return;
  // Don't double-notify when there's a level-up — the level-up message replaces it.
  const user = await userMention(userId);
  const announced = await announceToRpgTopic(
    `⚔️ ${user} приволок в логово ${result.gained} опыта. Всего в его тени: ${result.totalXp}.`,
  );
  if (announced) return;
  try {
    await bot.telegram.sendMessage(
      userId,
      `🪙 +${result.gained} опыта тебе, свой. Всего накопил: ${result.totalXp}.`,
    );
  } catch (err) {
    logger.debug({ err, userId, source }, 'sendXpGainNotification failed (probably blocked bot)');
  }
}

/** Announce a level-up: publicly in the RPG topic when configured, AND always
 * as a personal DM (the legacy bot's sendPrivateMessage behavior). */
export async function sendLevelUpNotification(userId: number, event: LevelUpEvent): Promise<void> {
  const user = await userMention(userId);
  if (event.type === 'tier') {
    const tier = tierByName(event.toTier);
    const emoji = tier?.emoji ?? '';
    const display = tier?.displayName ?? event.toTier;
    await announceToRpgTopic(
      `${emoji} Бей в барабаны! ${user} вознёсся в ${escapeHtml(display)} — уровень ${event.toLevel}!\nТакое высекают на камне. Старейшины запомнят.`,
    );
    try {
      await bot.telegram.sendMessage(
        userId,
        `🎉 Растёшь, свой! Новый ранг: ${emoji} <b>${display}</b> (уровень ${event.toLevel}). Старейшины кивнули.`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      logger.debug({ err, userId, event }, 'sendLevelUpNotification DM failed');
    }
    return;
  }
  const tier = tierByName(event.tier);
  const emoji = tier?.emoji ?? '';
  await announceToRpgTopic(
    `${emoji} ${user} взял уровень ${event.to} — растёт, зараза, на радость Главгоблину!`,
  );
  try {
    await bot.telegram.sendMessage(
      userId,
      `⬆️ Опыт капает — уровень ${event.to} ${emoji}. Так и до нового ранга дорастёшь, свой.`,
    );
  } catch (err) {
    logger.debug({ err, userId, event }, 'sendLevelUpNotification DM failed');
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
  })().catch((err) => logger.warn({ err, userId, source }, 'dispatchNotifications failed'));
}

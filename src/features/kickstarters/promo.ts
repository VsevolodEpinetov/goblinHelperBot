import { bot } from '../../core/bot';
import { featureConfig } from '../../core/config';
import { logger } from '../../core/observability';
import { db } from '../../db/client';

import { formatKickstarterCard } from './format';
import { kickstarterPromoKeyboard } from './menus';
import { getKickstarterById, getKickstarterPhotos } from './repo';

/**
 * Announce a freshly created kickstarter in the group's kickstarters topic
 * (MAIN_GROUP_ID / KICKSTARTERS_TOPIC_ID from featureConfig). No-op without a
 * group id; on a failed send, alerts the admin chat so the card can be posted
 * by hand.
 */
export async function postKickstarterPromo(kickstarterId: number): Promise<void> {
  const fc = featureConfig();
  if (!fc.mainGroupId) return;
  const messageId = await sendKickstarterPromo(
    kickstarterId,
    fc.mainGroupId,
    fc.kickstartersTopicId,
  );
  if (messageId !== undefined || !fc.adminNotificationsChat) return;
  try {
    await bot.telegram.sendMessage(
      fc.adminNotificationsChat,
      `⚠️ Кикстартер #${kickstarterId} создан, но в логово не выслан. Закинь карточку в топик руками.`,
    );
  } catch (err) {
    logger.error({ err, kickstarterId }, 'postKickstarterPromo: admin alert failed');
  }
}

/** Post a kickstarter promo to the configured group + topic. Returns the posted message id, or undefined on failure. */
export async function sendKickstarterPromo(
  kickstarterId: number,
  groupChatId: string,
  topicId?: number,
): Promise<number | undefined> {
  const ks = await getKickstarterById(db, kickstarterId);
  if (!ks) {
    logger.warn({ kickstarterId }, 'sendKickstarterPromo: kickstarter not found');
    return undefined;
  }
  const photos = await getKickstarterPhotos(db, kickstarterId);
  try {
    const text = formatKickstarterCard(ks);
    const kb = kickstarterPromoKeyboard(kickstarterId, bot.botInfo?.username);
    const baseOpts: { parse_mode: 'HTML'; message_thread_id?: number } = { parse_mode: 'HTML' };
    if (topicId !== undefined) baseOpts.message_thread_id = topicId;

    // A kickstarter carries at most one photo, so the «Провести ритуал» deep
    // link can ride on the card (a media group can't hold inline buttons).
    if (photos.length === 0) {
      const msg = await bot.telegram.sendMessage(groupChatId, text, { ...baseOpts, ...kb });
      return msg.message_id;
    }
    const msg = await bot.telegram.sendPhoto(groupChatId, photos[0]!.fileId, {
      caption: text,
      ...baseOpts,
      ...kb,
    });
    return msg.message_id;
  } catch (err) {
    logger.error({ err, kickstarterId, groupChatId }, 'sendKickstarterPromo: send failed');
    return undefined;
  }
}

import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { db } from '../../db/client';

import { formatKickstarterCard } from './format';
import { getKickstarterById, getKickstarterPhotos } from './repo';

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
    const baseOpts: { parse_mode: 'HTML'; message_thread_id?: number } = { parse_mode: 'HTML' };
    if (topicId !== undefined) baseOpts.message_thread_id = topicId;

    if (photos.length === 0) {
      const msg = await bot.telegram.sendMessage(groupChatId, text, baseOpts);
      return msg.message_id;
    }
    if (photos.length === 1) {
      const msg = await bot.telegram.sendPhoto(groupChatId, photos[0]!.fileId, {
        caption: text,
        ...baseOpts,
      });
      return msg.message_id;
    }
    // 2+ photos: send a media group; first item carries the caption.
    const media = photos.map((p, i) => ({
      type: 'photo' as const,
      media: p.fileId,
      ...(i === 0 ? { caption: text, parse_mode: 'HTML' as const } : {}),
    }));
    const msgs = await bot.telegram.sendMediaGroup(groupChatId, media, baseOpts);
    return msgs[0]?.message_id;
  } catch (err) {
    logger.error({ err, kickstarterId, groupChatId }, 'sendKickstarterPromo: send failed');
    return undefined;
  }
}

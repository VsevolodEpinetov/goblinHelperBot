import { bot } from '../../core/bot';
import { featureConfig } from '../../core/config';
import { logger } from '../../core/observability';
import { db } from '../../db/client';
import { escapeHtml } from '../../shared/format';

import { formatRaidMessage } from './format';
import { publicRaidKeyboard } from './menus';
import {
  clearRaidPublicMessage,
  getRaidById,
  getRaidParticipants,
  getRaidPhotos,
  updateRaidPublicMessage,
} from './repo';

// The main community group + the raids topic within it come from featureConfig
// (MAIN_GROUP_ID / RAIDS_TOPIC_ID); when unset (e.g. local dev), raids simply
// aren't broadcast to a group.

function topicExtra(): { message_thread_id?: number } {
  const topicId = featureConfig().raidsTopicId;
  return topicId ? { message_thread_id: topicId } : {};
}

/**
 * Per-raid serialization. The card is mutated by delete+repost, which is a
 * read→delete→repost→store sequence; two concurrent runs (two members joining at
 * once) would each delete the same id and repost, leaking an orphan card the DB
 * no longer tracks. Chaining per raid id makes the second run read the message id
 * the first one just stored, so it deletes the right card.
 */
const raidLocks = new Map<number, Promise<void>>();
function withRaidLock(raidId: number, fn: () => Promise<void>): Promise<void> {
  const prev = raidLocks.get(raidId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tracked: Promise<void> = next.then(
    () => {
      if (raidLocks.get(raidId) === tracked) raidLocks.delete(raidId);
    },
    () => {
      if (raidLocks.get(raidId) === tracked) raidLocks.delete(raidId);
    },
  );
  raidLocks.set(raidId, tracked);
  return next;
}

/** Telegram photo captions cap at 1024 chars; raid descriptions can be longer.
 * Trim on a line boundary so we never split an HTML tag (each tag stays on one line). */
export function capCaption(text: string): string {
  const LIMIT = 1024;
  if (text.length <= LIMIT) return text;
  let cut = text.slice(0, LIMIT - 2);
  const lastNl = cut.lastIndexOf('\n');
  if (lastNl > 0) cut = cut.slice(0, lastNl);
  return `${cut}\n…`;
}

/**
 * Post the raid's card (first photo + info + Join/Leave) into the raids topic and
 * store the new message id. Only open raids are posted. No-op without a group id.
 */
export function postRaidCard(raidId: number): Promise<void> {
  if (!featureConfig().mainGroupId) return Promise.resolve();
  return withRaidLock(raidId, () => doPostRaidCard(raidId));
}

async function doPostRaidCard(raidId: number): Promise<void> {
  const groupId = featureConfig().mainGroupId;
  if (!groupId) return;
  const raid = await getRaidById(db, raidId);
  if (!raid || raid.status !== 'open') return;
  const participants = await getRaidParticipants(db, raidId);
  const caption = capCaption(formatRaidMessage(raid, participants));
  const photos = await getRaidPhotos(db, raidId);
  const kb = publicRaidKeyboard({ id: raid.id, status: raid.status }, bot.botInfo?.username);
  try {
    let messageId: number;
    if (photos.length > 0 && photos[0]) {
      const msg = await bot.telegram.sendPhoto(groupId, photos[0].fileId, {
        caption,
        parse_mode: 'HTML',
        ...topicExtra(),
        ...kb,
      });
      messageId = msg.message_id;
    } else {
      const msg = await bot.telegram.sendMessage(groupId, caption, {
        parse_mode: 'HTML',
        ...topicExtra(),
        ...kb,
      });
      messageId = msg.message_id;
    }
    await updateRaidPublicMessage(db, raidId, groupId, String(messageId));
  } catch (err) {
    logger.error({ err, raidId }, 'postRaidCard failed');
    await alertCardPostFailure(raidId, err);
  }
}

/** A card that never lands in the topic is invisible to the whole group —
 * alert the admin chat instead of burying the failure in logs (the usual
 * culprit is a wrong RAIDS_TOPIC_ID / MAIN_GROUP_ID). */
async function alertCardPostFailure(raidId: number, err: unknown): Promise<void> {
  const adminChat = featureConfig().adminNotificationsChat;
  if (!adminChat) return;
  const reason = escapeHtml(err instanceof Error ? err.message : String(err));
  try {
    await bot.telegram.sendMessage(
      adminChat,
      `⚠️ <b>Карточка рейда не легла в логово</b>\nРейд #${raidId}, причина: ${reason}\nПроверь MAIN_GROUP_ID и RAIDS_TOPIC_ID.`,
      { parse_mode: 'HTML' },
    );
  } catch (alertErr) {
    logger.error({ err: alertErr, raidId }, 'postRaidCard failure: admin alert failed');
  }
}

/**
 * Keep a single, fresh card in the topic: delete the old message and (while the
 * raid is still open) repost an updated one, which also bumps it to the bottom of
 * the topic so active raids stay visible. Finished raids are removed from the topic.
 */
export function resyncRaidCard(raidId: number): Promise<void> {
  if (!featureConfig().mainGroupId) return Promise.resolve();
  return withRaidLock(raidId, () => doResyncRaidCard(raidId));
}

async function doResyncRaidCard(raidId: number): Promise<void> {
  const raid = await getRaidById(db, raidId);
  if (!raid) return;
  if (raid.chatId && raid.messageId) {
    try {
      await bot.telegram.deleteMessage(raid.chatId, Number(raid.messageId));
    } catch (err) {
      logger.debug({ err, raidId }, 'resyncRaidCard: delete old message failed');
    }
  }
  // Call the un-locked body directly: we already hold the per-raid lock.
  if (raid.status === 'open') {
    await doPostRaidCard(raidId);
  } else {
    await clearRaidPublicMessage(db, raidId);
  }
}

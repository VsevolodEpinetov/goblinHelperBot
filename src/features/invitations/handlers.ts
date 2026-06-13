import { Markup, type Telegraf, type Telegram } from 'telegraf';

import { featureConfig } from '../../core/config';
import { logger, metrics } from '../../core/observability';
import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { hasAllArchiveAccess, isStaff } from '../../shared/user-status';
import { homeButton } from '../onboarding/menus';

import { findLatestForUser, markUsed, type GroupType } from './repo';

/**
 * Admin rights granted to staff who join a monthly-archive chat. Spans both
 * supergroup- and channel-specific fields, so the same call works whether the
 * archive is a group or a channel — Telegram applies the ones that fit the
 * chat type and ignores the rest. Full admin per project decision (incl.
 * promoting others and editing chat info). The bot can only confer rights it
 * holds, so this is best-effort.
 */
const STAFF_PROMOTE_RIGHTS = {
  is_anonymous: false,
  can_manage_chat: true,
  can_change_info: true,
  can_delete_messages: true,
  can_invite_users: true,
  can_restrict_members: true,
  can_pin_messages: true,
  can_promote_members: true,
  can_manage_video_chats: true,
  can_manage_topics: true,
  can_post_messages: true,
  can_edit_messages: true,
  can_post_stories: true,
  can_edit_stories: true,
  can_delete_stories: true,
} as const;

/** Best-effort promote a staff member to admin in the archive they just joined. */
async function promoteStaffInArchive(
  ctx: { telegram: Telegram },
  chatId: string,
  userId: number,
): Promise<void> {
  try {
    await ctx.telegram.promoteChatMember(chatId, userId, STAFF_PROMOTE_RIGHTS);
    metrics.incr('invitations.staff_promoted');
    logger.info({ userId, chatId }, 'archive join: staff auto-promoted to admin');
  } catch (err) {
    // Usually means the bot itself lacks can_promote_members in that chat.
    logger.warn(
      { err, userId, chatId },
      'archive join: staff auto-promote failed (bot may lack promote rights)',
    );
  }
}

interface MonthRow {
  id: number;
  period: string;
  type: GroupType;
  chat_id: string;
}

async function findMonthByChatId(chatId: string): Promise<MonthRow | undefined> {
  return db('months').where('chat_id', chatId).first();
}

async function userHasAccess(userId: number, period: string, type: GroupType): Promise<boolean> {
  const row = await db('user_groups').where({ user_id: userId, period, type }).first();
  return !!row;
}

/** True if the user has paid for ANY period — i.e. belongs in the main group. */
async function userHasAnyPaidAccess(userId: number): Promise<boolean> {
  const row = await db('user_groups').where('user_id', userId).first();
  return !!row;
}

/** Decline the join request and best-effort DM the requester why. */
async function declineAndNotify(
  ctx: { declineChatJoinRequest: (userId: number) => Promise<unknown>; telegram: Telegram },
  userId: number,
  text: string,
): Promise<void> {
  try {
    await ctx.declineChatJoinRequest(userId);
  } catch (err) {
    logger.warn({ err, userId }, 'chat_join_request: decline failed');
  }
  try {
    await ctx.telegram.sendMessage(userId, text, Markup.inlineKeyboard([[homeButton()]]));
  } catch {
    /* user never started the bot — nothing to do */
  }
}

export function registerInvitationHandlers(bot: Telegraf): void {
  bot.on('chat_join_request', async (ctx) => {
    const req = ctx.chatJoinRequest;
    if (!req) return;
    const userId = req.from.id;
    const chatId = String(req.chat.id);

    // Main community group: approve any paying member (or staff). Same
    // bot-guards-the-door model as the month archives, just keyed on "has the
    // user paid for anything" rather than a specific period.
    const mainGroupId = featureConfig().mainGroupId;
    if (mainGroupId && chatId === mainGroupId) {
      const roles = await getRolesForUser(db, userId);
      // Friends and staff belong in the lair without a payment on file.
      const allowed = hasAllArchiveAccess(roles) || (await userHasAnyPaidAccess(userId));
      if (!allowed) {
        logger.info({ userId }, 'main-group join: denied (no paid access)');
        metrics.incr('invitations.main_join_denied');
        await declineAndNotify(
          ctx,
          userId,
          '🌑 В логово не пустил: платы за тобой не числится. Возьми архив через меню — кнопка ниже, — тогда и дверь откроется.',
        );
        return;
      }
      try {
        await ctx.approveChatJoinRequest(userId);
        metrics.incr('invitations.main_join_approved');
        logger.info({ userId }, 'main-group join approved');
      } catch (err) {
        logger.error({ err, userId }, 'main-group join: approve failed');
      }
      return;
    }

    const month = await findMonthByChatId(chatId);
    if (!month) {
      logger.warn({ chatId }, 'chat_join_request: no month row for chat');
      metrics.incr('invitations.join_unknown_chat');
      return;
    }

    const roles = await getRolesForUser(db, userId);
    const isStaffUser = isStaff(roles);
    // Staff (by office) and friends (comped) reach every archive; everyone else
    // needs a payment record for this specific month.
    const hasAccess =
      hasAllArchiveAccess(roles) || (await userHasAccess(userId, month.period, month.type));
    if (!hasAccess) {
      logger.info(
        { userId, chatId, period: month.period },
        'chat_join_request: denied (no access)',
      );
      metrics.incr('invitations.join_denied');
      await declineAndNotify(
        ctx,
        userId,
        '🌑 В этот архив не пустил: платы за этот месяц за тобой нет. Возьми архив через меню — кнопка ниже, — и ключ сам принесу.',
      );
      return;
    }

    try {
      await ctx.approveChatJoinRequest(userId);
    } catch (err) {
      logger.error({ err, userId, chatId }, 'chat_join_request: approve failed');
      return;
    }

    // Auto-promote staff to admin in the archive they just entered (groups and
    // channels alike). Friends are never promoted — they're guests, not council.
    if (isStaffUser) {
      await promoteStaffInArchive(ctx, chatId, userId);
    }

    await db('months')
      .where({ period: month.period, type: month.type })
      .increment('counter_joined', 1);

    // Best-effort: mark the user's most recent invite as used
    try {
      const latest = await findLatestForUser(db, userId, month.period, month.type);
      if (latest && latest.usedAt === null) {
        await markUsed(db, latest.id);
      }
    } catch (err) {
      logger.warn({ err, userId, period: month.period }, 'mark-used post-join failed');
    }

    metrics.incr('invitations.join_approved');
    logger.info(
      { userId, period: month.period, type: month.type, staff: isStaffUser },
      'join approved',
    );
  });
}

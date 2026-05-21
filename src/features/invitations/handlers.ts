import type { Telegraf } from 'telegraf';

import { logger, metrics } from '../../core/observability';
import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { isStaff } from '../../shared/user-status';

import { findLatestForUser, markUsed, type GroupType } from './repo';

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

export function registerInvitationHandlers(bot: Telegraf): void {
  bot.on('chat_join_request', async (ctx) => {
    const req = ctx.chatJoinRequest;
    if (!req) return;
    const userId = req.from.id;
    const chatId = String(req.chat.id);

    const month = await findMonthByChatId(chatId);
    if (!month) {
      logger.warn({ chatId }, 'chat_join_request: no month row for chat');
      metrics.incr('invitations.join_unknown_chat');
      return;
    }

    const roles = await getRolesForUser(db, userId);
    const isStaffUser = isStaff(roles);
    const hasAccess = isStaffUser || (await userHasAccess(userId, month.period, month.type));
    if (!hasAccess) {
      logger.info(
        { userId, chatId, period: month.period },
        'chat_join_request: denied (no access)',
      );
      metrics.incr('invitations.join_denied');
      return;
    }

    try {
      await ctx.approveChatJoinRequest(userId);
    } catch (err) {
      logger.error({ err, userId, chatId }, 'chat_join_request: approve failed');
      return;
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

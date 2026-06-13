import type { Context, MiddlewareFn } from 'telegraf';

import { logger, metrics } from '../observability';

import { isBannedCached } from './roles-cache';

const ERROR_MESSAGE = '🌑 Логово молчит — не достучишься. Попробуй позже.';

async function notify(ctx: Context): Promise<void> {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(ERROR_MESSAGE);
    } else if (ctx.chat?.type === 'private') {
      await ctx.reply(ERROR_MESSAGE);
    }
  } catch {
    /* user-block from us, ignore */
  }
}

export function createBannedMiddleware(
  isBannedFn: (userId: number) => Promise<boolean>,
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.from) return next();
    try {
      const banned = await isBannedFn(ctx.from.id);
      if (banned) {
        metrics.incr('banned.blocked');
        await notify(ctx);
        return;
      }
      return next();
    } catch (err) {
      metrics.incr('banned.db_error');
      logger.error({ err, userId: ctx.from.id }, 'banned middleware: DB error, failing CLOSED');
      await notify(ctx);
      return;
    }
  };
}

export const bannedMiddleware: MiddlewareFn<Context> = createBannedMiddleware(isBannedCached);

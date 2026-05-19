import type { Context, MiddlewareFn } from 'telegraf';

import { db } from '../../db/client';
import { isBanned as defaultIsBanned } from '../../db/repos/user-roles';
import { logger, metrics } from '../observability';

const ERROR_MESSAGE = 'Сейчас бот не может ответить. Попробуй позже.';

export function createBannedMiddleware(
  isBannedFn: (userId: number) => Promise<boolean>,
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.from) return next();
    try {
      const banned = await isBannedFn(ctx.from.id);
      if (banned) {
        metrics.incr('banned.blocked');
        try {
          await ctx.reply(ERROR_MESSAGE);
        } catch {
          /* user-block from us, ignore */
        }
        return;
      }
      return next();
    } catch (err) {
      metrics.incr('banned.db_error');
      logger.error({ err, userId: ctx.from.id }, 'banned middleware: DB error, failing CLOSED');
      try {
        await ctx.reply(ERROR_MESSAGE);
      } catch {
        /* ignore */
      }
      return;
    }
  };
}

export const bannedMiddleware: MiddlewareFn<Context> = createBannedMiddleware((id) =>
  defaultIsBanned(db, id),
);

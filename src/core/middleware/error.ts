import type { Context, MiddlewareFn } from 'telegraf';

import { logger, metrics } from '../observability';

const USER_ERROR_MESSAGE = 'Произошла ошибка. Попробуй ещё раз через минуту.';

export const errorMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    metrics.incr('error.unhandled');
    logger.error(
      {
        err,
        updateType: Object.keys(ctx.update).filter((k) => k !== 'update_id')[0],
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
      },
      'Unhandled error in middleware chain',
    );
    if (ctx.from) {
      try {
        await ctx.reply(USER_ERROR_MESSAGE);
      } catch (replyErr) {
        logger.warn({ replyErr }, 'Could not send user-facing error message');
      }
    }
  }
};

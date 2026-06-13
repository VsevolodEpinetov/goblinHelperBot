import type { Context, MiddlewareFn } from 'telegraf';

import { logger, metrics } from '../observability';

export const loggerMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const updateType = Object.keys(ctx.update).filter((k) => k !== 'update_id')[0] ?? 'unknown';
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const start = Date.now();

  logger.info({ updateType, userId, chatId }, 'incoming update');
  metrics.incr(`update.${updateType}`);

  try {
    await next();
  } finally {
    metrics.recordMs('handler.latency', Date.now() - start);
  }
};

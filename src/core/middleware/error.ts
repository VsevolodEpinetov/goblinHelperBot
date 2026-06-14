import type { Context, MiddlewareFn } from 'telegraf';

import { isApprovedMember } from '../../shared/user-status';
import { homeKeyboard } from '../nav';
import { logger, metrics } from '../observability';

const USER_ERROR_MESSAGE =
  '🕯 Что-то треснуло в недрах логова — приказ не выполнен. Подожди минуту и попробуй снова.';

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
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery(USER_ERROR_MESSAGE, { show_alert: true });
      } catch (replyErr) {
        logger.warn({ replyErr }, 'Could not answer callback query with error message');
      }
    } else if (ctx.from && ctx.chat?.type === 'private') {
      try {
        // Members get a home button — an error is exactly when their menu is
        // broken; outsiders just get the text (their recovery is /start anyway).
        const member = isApprovedMember(ctx.state?.roles ?? []);
        await ctx.reply(USER_ERROR_MESSAGE, member ? homeKeyboard() : undefined);
      } catch (replyErr) {
        logger.warn({ replyErr }, 'Could not send user-facing error message');
      }
    }
  }
};

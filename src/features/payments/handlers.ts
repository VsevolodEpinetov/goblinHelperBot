import type { Context, Telegraf } from 'telegraf';

import { logger, metrics } from '../../core/observability';

import { decodePayload, processSuccessfulPayment } from './service';

/**
 * Single source for both pre_checkout_query and successful_payment.
 * Replaces FOUR separate handlers in the legacy codebase.
 */
export function registerPaymentHandlers(bot: Telegraf): void {
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery;
    if (!q) return;
    const payload = decodePayload(q.invoice_payload);
    if (!payload) {
      logger.warn({ payload: q.invoice_payload }, 'pre_checkout_query: invalid payload, rejecting');
      metrics.incr('payments.precheckout_rejected');
      await ctx.answerPreCheckoutQuery(false, 'Не удалось проверить платёж. Попробуй позже.');
      return;
    }
    metrics.incr('payments.precheckout_accepted');
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on('successful_payment', async (ctx) => {
    const sp = (
      ctx.message as {
        successful_payment?: {
          invoice_payload: string;
          total_amount: number;
          currency: string;
          telegram_payment_charge_id: string;
        };
      }
    ).successful_payment;
    if (!sp) return;
    const result = await processSuccessfulPayment(
      sp.invoice_payload,
      sp.total_amount,
      sp.currency,
      sp.telegram_payment_charge_id,
    );
    switch (result.status) {
      case 'processed':
        await sendUserConfirmation(ctx, 'Платёж получен.');
        break;
      case 'already_processed':
        logger.info(
          { chargeId: sp.telegram_payment_charge_id },
          'duplicate successful_payment, ignored',
        );
        break;
      case 'refund_required':
        await issueRefund(
          ctx,
          result.refundUserId!,
          sp.telegram_payment_charge_id,
          result.refundReason ?? 'неизвестная причина',
        );
        break;
      case 'unknown_payload':
        // Unknown payloads are also a refund case: the user paid for a
        // payload the bot doesn't understand, so they got nothing.
        if (ctx.from) {
          await issueRefund(
            ctx,
            ctx.from.id,
            sp.telegram_payment_charge_id,
            'неизвестный тип платежа',
          );
        }
        logger.error({ payload: sp.invoice_payload }, 'successful_payment with unknown payload');
        break;
    }
  });
}

async function issueRefund(
  ctx: Context,
  userId: number,
  chargeId: string,
  reason: string,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.telegram as any).refundStarPayment(userId, chargeId);
    metrics.incr('payments.refund_issued');
    logger.info({ userId, chargeId, reason }, 'star payment refunded');
    try {
      await ctx.telegram.sendMessage(
        userId,
        `Платёж возвращён: ${reason}. Звёзды должны вернуться в течение нескольких минут.`,
      );
    } catch (notifyErr) {
      logger.debug({ notifyErr, userId }, 'refund notification DM failed');
    }
  } catch (err) {
    metrics.incr('payments.refund_failed');
    logger.error(
      { err, userId, chargeId, reason },
      'star payment refund FAILED — needs manual handling',
    );
  }
}

async function sendUserConfirmation(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (err) {
    logger.debug({ err }, 'sendUserConfirmation: failed');
  }
}

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
      case 'unknown_payload':
        logger.error({ payload: sp.invoice_payload }, 'successful_payment with unknown payload');
        break;
    }
  });
}

async function sendUserConfirmation(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (err) {
    logger.debug({ err }, 'sendUserConfirmation: failed');
  }
}

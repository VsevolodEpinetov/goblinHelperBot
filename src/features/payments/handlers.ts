import { Markup } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';

import { featureConfig } from '../../core/config';
import { logger, metrics } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { getKickstarterFiles, hasUserPurchased } from '../kickstarters/repo';
import { ksCallback } from '../kickstarters/schemas';
import { homeButton } from '../onboarding/menus';
import { getSubscriptionStatus } from '../subscriptions/repo';

import { deliverAccessKeys } from './invite-delivery';
import type { PaymentPayloadT } from './schemas';
import { accessGroupForPayload, decodePayload, processSuccessfulPayment } from './service';

/** Reason to reject the pre-checkout with, or null when the purchase is valid. */
async function precheckoutRejectionReason(payload: PaymentPayloadT): Promise<string | null> {
  switch (payload.t) {
    case 'sub':
    case 'old': {
      const status = await getSubscriptionStatus(db, payload.userId, payload.period);
      if (status.hasPlus || (payload.tier === 'regular' && status.hasRegular)) {
        return 'Этот архив у тебя уже есть — второй раз не продам.';
      }
      return null;
    }
    case 'upgrade': {
      const status = await getSubscriptionStatus(db, payload.userId, payload.period);
      if (status.hasPlus) return 'Расширенный архив у тебя уже есть — второй раз не продам.';
      if (!status.hasRegular) return 'Сначала возьми обычный архив, потом расширяй.';
      return null;
    }
    case 'ks': {
      if (await hasUserPurchased(db, payload.userId, payload.kickstarterId)) {
        return 'Этот кикстартер у тебя уже есть — второй раз не продам.';
      }
      return null;
    }
  }
}

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
    if (q.from.id !== payload.userId) {
      logger.warn(
        { fromId: q.from.id, payloadUserId: payload.userId },
        'pre_checkout_query: payer is not the invoice owner, rejecting',
      );
      metrics.incr('payments.precheckout_rejected');
      await ctx.answerPreCheckoutQuery(
        false,
        'Счёт выписан не на тебя — чужое не приму. Возьми свой через меню.',
      );
      return;
    }
    try {
      const rejection = await precheckoutRejectionReason(payload);
      if (rejection) {
        logger.info({ payload }, 'pre_checkout_query: already owned, rejecting');
        metrics.incr('payments.precheckout_rejected');
        await ctx.answerPreCheckoutQuery(false, rejection);
        return;
      }
    } catch (err) {
      logger.error({ err, payload }, 'pre_checkout_query: ownership check failed, rejecting');
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
    try {
      await handleSuccessfulPayment(ctx, sp);
    } catch (err) {
      // Telegram never redelivers a successful_payment update: if processing
      // throws, the Stars are charged but nothing is granted. Log everything
      // needed for manual recovery and alert the совет.
      metrics.incr('payments.process_failed');
      logger.error(
        {
          err,
          payload: sp.invoice_payload,
          chargeId: sp.telegram_payment_charge_id,
          amount: sp.total_amount,
          currency: sp.currency,
        },
        'successful_payment processing FAILED — needs manual handling',
      );
      const adminChat = featureConfig().adminNotificationsChat;
      if (adminChat) {
        try {
          await ctx.telegram.sendMessage(
            adminChat,
            `⚠️ Платёж принят, но не обработан — нужно разгрести руками.\nПользователь: ${ctx.from?.id ?? '—'}\ncharge_id: ${sp.telegram_payment_charge_id}\npayload: ${sp.invoice_payload}\nСумма: ${sp.total_amount} ${sp.currency}`,
          );
        } catch (alertErr) {
          logger.error({ alertErr }, 'failed to alert admins about stuck payment');
        }
      }
      await sendUserConfirmation(
        ctx,
        '🪙 Звёзды дошли, но в записях заело. Совет уже в курсе — разберут руками, своё получишь.',
      );
    }
  });
}

async function handleSuccessfulPayment(
  ctx: Context,
  sp: {
    invoice_payload: string;
    total_amount: number;
    currency: string;
    telegram_payment_charge_id: string;
  },
): Promise<void> {
  const result = await processSuccessfulPayment(
    sp.invoice_payload,
    sp.total_amount,
    sp.currency,
    sp.telegram_payment_charge_id,
  );
  switch (result.status) {
    case 'processed': {
      const payload = decodePayload(sp.invoice_payload);
      // Kickstarter pledges paid with Stars have no group key — they deliver
      // files, exactly like the scroll path does. (Without this the buyer
      // pays and gets nothing.)
      if (payload && payload.t === 'ks') {
        await deliverKickstarterFiles(ctx, payload.kickstarterId);
        break;
      }
      const group = payload ? accessGroupForPayload(payload) : null;
      if (payload && group) {
        // deliverAccessKeys DMs the key(s) AND confirms the payment, with a home
        // button — so no separate (affordance-less) confirmation message here.
        await deliverAccessKeys({
          telegram: ctx.telegram,
          userId: payload.userId,
          period: group.period,
          type: group.type,
        });
      } else {
        await sendUserConfirmation(ctx, '🪙 Звёзды легли в казну, свой. Платёж принят.');
      }
      break;
    }
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
        `🪙 Платёж вернул: ${reason}. Звёзды прилетят обратно в течение нескольких минут.`,
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
    await ctx.reply(text, Markup.inlineKeyboard([[homeButton()]]));
  } catch (err) {
    logger.debug({ err }, 'sendUserConfirmation: failed');
  }
}

/** Deliver a Stars-bought kickstarter's files + a confirmation with a way back. */
async function deliverKickstarterFiles(ctx: Context, kickstarterId: number): Promise<void> {
  try {
    const files = await getKickstarterFiles(db, kickstarterId);
    for (const f of files) {
      try {
        await ctx.replyWithDocument(f.fileId);
      } catch (err) {
        logger.warn({ err, fileId: f.fileId, kickstarterId }, 'ks Stars file delivery failed');
      }
    }
    await ctx.reply(
      '🎯 Звёзды в казне, добыча твоя — лежит теперь в «🎯 Мои кикстартеры», оттуда никто не утащит.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🎯 Мои кикстартеры', router.encode(ksCallback, { a: 'ksMine' }))],
        [homeButton()],
      ]),
    );
  } catch (err) {
    logger.error({ err, kickstarterId }, 'deliverKickstarterFiles failed');
  }
}

import { Markup, type Context, type Telegraf } from 'telegraf';

import { logger, metrics } from '../../core/observability';
import { db } from '../../db/client';
import { escapeHtml } from '../../shared/format';
import { service as invitationsService } from '../invitations/service';
import { listUserSubscriptions } from '../subscriptions';

import { accessGroupForPayload, decodePayload, processSuccessfulPayment } from './service';

const ADMIN_NOTIFICATIONS_CHAT = process.env.ADMIN_NOTIFICATIONS_CHAT ?? '';

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
        await deliverInviteLink(ctx, sp.invoice_payload);
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

/**
 * After a processed group payment, DM the buyer their personal one-time invite
 * link (on a button). No-op for payments that grant no group access (e.g.
 * kickstarter). Best-effort: never throws back into the payment handler.
 */
async function deliverInviteLink(ctx: Context, payloadJson: string): Promise<void> {
  const payload = decodePayload(payloadJson);
  if (!payload) return;
  const group = accessGroupForPayload(payload);
  if (!group) return;
  try {
    const result = await invitationsService.getOrCreateInvitationLink({
      userId: payload.userId,
      period: group.period,
      type: group.type,
    });
    if (result.status === 'no_chat') {
      await ctx.telegram.sendMessage(
        payload.userId,
        '🌑 Звёзды твои в казне, доступ за тобой записан — а вот дверь библиотекарь ещё не отпер. Добыча в целости, никуда не денется. Загляни позже через /start и жми кнопку, или жди — ключ придёт.',
      );
      // Alert the совет: a paid member is stuck because no chat is bound yet.
      if (ADMIN_NOTIFICATIONS_CHAT) {
        const who = escapeHtml(
          ctx.from?.username ? `@${ctx.from.username}` : `id:${payload.userId}`,
        );
        await ctx.telegram.sendMessage(
          ADMIN_NOTIFICATIONS_CHAT,
          `⚠️ <b>Архив без двери</b>\nСвой ${who} оплатил ${group.period}/${group.type}, но чат месяца не привязан — ключ выдать некуда. Привяжи группу через /admin → Months.`,
          { parse_mode: 'HTML' },
        );
      }
      return;
    }
    // First paid period → also hand them the key to the main community group.
    if (await isFirstPaidPeriod(payload.userId)) {
      const main = await invitationsService.createMainGroupLink(payload.userId);
      if (main.status === 'created') {
        await ctx.telegram.sendMessage(
          payload.userId,
          `🔥 Ну всё, ты теперь свой. Логово тебя приняло.\nВнизу два ключа — каждый пускает только тебя и только раз.\nОдин — в главный зал логова, где собираются все. Второй — в месячный архив за ${group.period}, что ты взял.`,
          Markup.inlineKeyboard([
            [Markup.button.url('🏰 Войти в логово', main.link)],
            [Markup.button.url('🔑 Открыть архив ключом', result.link)],
          ]),
        );
        return;
      }
      logger.warn(
        { userId: payload.userId },
        'first paid period but MAIN_GROUP_ID unset — archive link only',
      );
    }

    // Returning member (or main group not configured): archive link only.
    await ctx.telegram.sendMessage(
      payload.userId,
      '🔑 Готово, свой. Твой личный ключ к месячному архиву — на кнопке ниже. Пустит только тебя и только раз. Не зевай.',
      Markup.inlineKeyboard([[Markup.button.url('🔑 Открыть архив ключом', result.link)]]),
    );
  } catch (err) {
    logger.error({ err, userId: payload.userId }, 'invite link delivery after payment failed');
  }
}

/** Whether this is the user's first paid period (→ they need the main-group key). */
async function isFirstPaidPeriod(userId: number): Promise<boolean> {
  const subs = await listUserSubscriptions(db, userId);
  const periods = new Set(subs.map((s) => s.period));
  return periods.size <= 1;
}

async function sendUserConfirmation(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (err) {
    logger.debug({ err }, 'sendUserConfirmation: failed');
  }
}

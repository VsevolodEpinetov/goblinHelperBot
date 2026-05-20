import type { Telegraf } from 'telegraf';

import { logger } from '../../core/observability';
import { requireRoles } from '../../core/permissions';
import { db } from '../../db/client';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';

import { markCompleted, markFailed } from './repo';

export function registerPaymentAdminActions(bot: Telegraf): void {
  bot.action(/^sbp:confirm:(\d+)$/, requireRoles('admin', 'super'), async (ctx) => {
    const raw = ctx.match[1];
    if (!raw) {
      await ctx.answerCbQuery('Bad payload');
      return;
    }
    const paymentId = Number(raw);
    try {
      const result = await db.transaction(async (trx) => {
        const payment = await trx('payment_tracking').where('id', paymentId).first();
        if (!payment) return { ok: false as const, reason: 'not_found' as const };
        if (payment.status === 'completed') {
          return { ok: false as const, reason: 'already_completed' as const };
        }

        // Use the admin-confirmation timestamp as charge id (SBP has no real Telegram charge).
        const chargeId = `sbp:${paymentId}:${Date.now()}`;
        await trx('user_groups')
          .insert({
            user_id: payment.user_id,
            period: payment.period,
            type: payment.subscription_type,
          })
          .onConflict(['user_id', 'period', 'type'])
          .ignore();
        await markCompleted(trx, paymentId, chargeId);
        await trx('months')
          .where({ period: payment.period, type: payment.subscription_type })
          .increment('counter_paid', 1);

        const xpAmount = payment.subscription_type === 'plus' ? 1600 : 600;
        const xp = await grantXpInTrx(trx, {
          userId: payment.user_id,
          amount: xpAmount,
          source: 'payment_sub_sbp',
          externalId: chargeId,
          description: `SBP подписка ${payment.subscription_type} за ${payment.period}`,
        });
        return { ok: true as const, userId: payment.user_id as number, xp };
      });

      if (result.ok) {
        dispatchNotifications(result.userId, result.xp, 'payment_sub_sbp');
        await ctx.answerCbQuery('Подтверждено');
        await ctx.editMessageCaption(`SBP #${paymentId} — ✅ подтверждён`, {});
      } else {
        await ctx.answerCbQuery(
          result.reason === 'already_completed' ? 'Уже подтверждён' : 'Не найден',
        );
      }
    } catch (err) {
      logger.error({ err, paymentId }, 'sbp confirm failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  bot.action(/^sbp:reject:(\d+)$/, requireRoles('admin', 'super'), async (ctx) => {
    const raw = ctx.match[1];
    if (!raw) {
      await ctx.answerCbQuery('Bad payload');
      return;
    }
    const paymentId = Number(raw);
    try {
      await markFailed(db, paymentId);
      await ctx.answerCbQuery('Отклонён');
      await ctx.editMessageCaption(`SBP #${paymentId} — ❌ отклонён`, {});
    } catch (err) {
      logger.error({ err, paymentId }, 'sbp reject failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });
}

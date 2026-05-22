import type { Telegraf } from 'telegraf';

import { logger } from '../../core/observability';
import { requireRoles } from '../../core/permissions';
import { db } from '../../db/client';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';

import { markFailed } from './repo';

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
        // Stable chargeId per payment row, so the partial UNIQUE on
        // telegram_payment_charge_id (migration 019) backs up the atomic
        // claim below.
        const chargeId = `sbp:${paymentId}`;

        // Atomic test-and-set: only the first concurrent admin claim wins.
        // Returning the row means we successfully flipped pending→completed.
        const claimed = await trx('payment_tracking')
          .where({ id: paymentId, status: 'pending' })
          .update({
            status: 'completed',
            telegram_payment_charge_id: chargeId,
            completed_at: trx.fn.now(),
          })
          .returning(['user_id', 'period', 'subscription_type']);

        if (claimed.length === 0) {
          // Either the row doesn't exist or it was already completed/failed.
          const existing = await trx('payment_tracking').where('id', paymentId).first();
          if (!existing) return { ok: false as const, reason: 'not_found' as const };
          return { ok: false as const, reason: 'already_completed' as const };
        }

        const row = claimed[0] as {
          user_id: number;
          period: string;
          subscription_type: 'regular' | 'plus';
        };

        await trx('user_groups')
          .insert({
            user_id: row.user_id,
            period: row.period,
            type: row.subscription_type,
          })
          .onConflict(['user_id', 'period', 'type'])
          .ignore();
        await trx('months')
          .where({ period: row.period, type: row.subscription_type })
          .increment('counter_paid', 1);

        const xpAmount = row.subscription_type === 'plus' ? 1600 : 600;
        const xp = await grantXpInTrx(trx, {
          userId: row.user_id,
          amount: xpAmount,
          source: 'payment_sub_sbp',
          externalId: chargeId,
          description: `SBP подписка ${row.subscription_type} за ${row.period}`,
        });
        return { ok: true as const, userId: row.user_id, xp };
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

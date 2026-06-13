import { Markup } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';

import { logger } from '../../core/observability';
import { requireAdmin } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { backToHubKeyboard, backToUserKeyboard } from '../admin/menus';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';
import { homeButton } from '../onboarding/menus';
import { subscriptionsCallback } from '../subscriptions/schemas';

import { deliverAccessKeys } from './invite-delivery';
import { listForUser, listPendingSbp } from './repo';
import { xpForSubscriptionPayment } from './service';

const SBP_QUEUE_LIMIT = 10;

/** After a verdict the card's confirm/reject buttons are gone — leave a path
 * back into the rest of the queue. */
const queueKb = Markup.inlineKeyboard([[Markup.button.callback('🪙 К очереди СБП', 'sbp:queue')]]);

/** The original review caption + the verdict + who decided — context stays in the chat. */
function verdictCaption(ctx: Context, paymentId: number, verdict: string): string {
  const original = (ctx.callbackQuery?.message as { caption?: string } | undefined)?.caption;
  const admin = ctx.from?.username
    ? `@${ctx.from.username}`
    : (ctx.from?.first_name ?? `id:${ctx.from?.id ?? '—'}`);
  const line = `${verdict} — ${admin}`;
  return original ? `${original}\n\n${line}` : `SBP #${paymentId}\n\n${line}`;
}

export function registerPaymentAdminActions(bot: Telegraf): void {
  // Queue cards (sbp:queue below) are plain text — the screenshot file_id is
  // not stored — while the scene's original cards are photos. The verdict
  // edits in the confirm/reject handlers are caption-based, so for caption-less
  // cards swap in a text edit that keeps the card body above the verdict line.
  bot.action(/^sbp:(?:confirm|reject):\d+$/, (ctx, next) => {
    const message = ctx.callbackQuery.message;
    if (message && !('caption' in message)) {
      const original = 'text' in message ? message.text : undefined;
      ctx.editMessageCaption = ((caption?: string, extra?: object) => {
        const line = caption?.split('\n\n').pop();
        return ctx.editMessageText(
          original && line ? `${original}\n\n${line}` : (caption ?? ''),
          extra,
        );
      }) as typeof ctx.editMessageCaption;
    }
    return next();
  });

  bot.action(/^sbp:confirm:(\d+)$/, requireAdmin(), async (ctx) => {
    const raw = ctx.match[1];
    if (!raw) {
      await ctx.answerCbQuery('Кривой запрос — не разобрал');
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
          .returning(['user_id', 'period', 'subscription_type', 'type']);

        if (claimed.length === 0) {
          // Either the row doesn't exist or it was already completed/failed.
          const existing = await trx('payment_tracking').where('id', paymentId).first('status');
          if (!existing) return { ok: false as const, reason: 'not_found' as const };
          return {
            ok: false as const,
            reason:
              existing.status === 'completed'
                ? ('already_completed' as const)
                : ('already_rejected' as const),
          };
        }

        const row = claimed[0] as {
          user_id: number;
          period: string;
          subscription_type: 'regular' | 'plus';
          type: string;
        };

        // The pending row can sit for days — the member may have meanwhile
        // bought the same period with Stars. Don't double-grant: mark the row
        // failed and surface it to the admin instead.
        const ownedRows = await trx('user_groups')
          .where({ user_id: row.user_id, period: row.period })
          .select('type');
        const ownedTypes = new Set(ownedRows.map((r: { type: string }) => r.type));
        if (
          ownedTypes.has('plus') ||
          (row.subscription_type === 'regular' && ownedTypes.has('regular'))
        ) {
          await trx('payment_tracking').where('id', paymentId).update({ status: 'failed' });
          return {
            ok: false as const,
            reason: 'already_owned' as const,
            userId: row.user_id,
            period: row.period,
          };
        }

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

        // Old archives grant the flat old-archive XP (matching the Stars 'old'
        // path); current-month subs grant the full tier XP.
        const xp = await grantXpInTrx(trx, {
          userId: row.user_id,
          amount: xpForSubscriptionPayment(row.type, row.subscription_type),
          source: 'payment_sub_sbp',
          externalId: chargeId,
          description: `SBP ${row.type === 'old' ? 'старый архив' : 'подписка'} ${row.subscription_type} за ${row.period}`,
        });
        return {
          ok: true as const,
          userId: row.user_id,
          period: row.period,
          type: row.subscription_type,
          xp,
        };
      });

      if (result.ok) {
        dispatchNotifications(result.userId, result.xp, 'payment_sub_sbp');
        await ctx.answerCbQuery('Подтверждено');
        await ctx.editMessageCaption(verdictCaption(ctx, paymentId, '✅ перевод зачтён'), queueKb);
        // Hand the buyer their archive key (+ main-group key on first payment),
        // the same delivery the Stars path does.
        await deliverAccessKeys({
          telegram: ctx.telegram,
          userId: result.userId,
          period: result.period,
          type: result.type,
        });
      } else if (result.reason === 'already_owned') {
        await ctx.answerCbQuery('За этот архив уже плачено звёздами — перевод верни руками', {
          show_alert: true,
        });
        await ctx.editMessageCaption(
          verdictCaption(
            ctx,
            paymentId,
            '⚠️ не зачтён: за этот архив уже плачено звёздами — перевод вернуть руками',
          ),
          queueKb,
        );
        try {
          await ctx.telegram.sendMessage(
            result.userId,
            `🪙 Совет глянул твой скрин за ${result.period} — а этот архив у тебя уже есть, звёздами взят. Второй раз в книгу не пишу. Насчёт перевода совет сам с тобой свяжется — жди.`,
            Markup.inlineKeyboard([[homeButton()]]),
          );
        } catch (dmErr) {
          logger.warn({ dmErr, paymentId, userId: result.userId }, 'sbp confirm: DM failed');
        }
      } else {
        await ctx.answerCbQuery(
          result.reason === 'already_completed'
            ? 'Уже подтверждён'
            : result.reason === 'already_rejected'
              ? 'Уже отклонён — приговор записан'
              : 'Не найден',
        );
      }
    } catch (err) {
      logger.error({ err, paymentId }, 'sbp confirm failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  bot.action(/^sbp:reject:(\d+)$/, requireAdmin(), async (ctx) => {
    const raw = ctx.match[1];
    if (!raw) {
      await ctx.answerCbQuery('Кривой запрос — не разобрал');
      return;
    }
    const paymentId = Number(raw);
    try {
      // Atomic claim, like confirm: only a still-pending row can be rejected,
      // so a stale duplicate card can't flip a completed payment to failed.
      const claimed = await db('payment_tracking')
        .where({ id: paymentId, status: 'pending' })
        .update({ status: 'failed' })
        .returning(['user_id', 'period']);
      if (claimed.length === 0) {
        const existing = await db('payment_tracking').where('id', paymentId).first('status');
        if (!existing) {
          await ctx.answerCbQuery('Не найден');
          return;
        }
        await ctx.answerCbQuery(
          existing.status === 'completed' ? 'Уже подтверждён' : 'Уже отклонён — приговор записан',
        );
        return;
      }
      const row = claimed[0] as { user_id: number; period: string };
      await ctx.answerCbQuery('Отклонён');
      await ctx.editMessageCaption(verdictCaption(ctx, paymentId, '❌ перевод не зачтён'), queueKb);
      try {
        await ctx.telegram.sendMessage(
          row.user_id,
          `⚖️ Совет глянул твой скрин за ${row.period} — и не зачёл. Проверь перевод и сумму, потом неси новый скрин.`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🪙 Снова к покупке',
                router.encode(subscriptionsCallback, { a: 'subOpen' }),
              ),
            ],
            [homeButton()],
          ]),
        );
      } catch (dmErr) {
        logger.warn({ dmErr, paymentId, userId: row.user_id }, 'sbp reject: DM failed');
      }
    } catch (err) {
      logger.error({ err, paymentId }, 'sbp reject failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  // Re-render pending SBP requests as actionable cards — the recovery surface
  // for a deleted/lost admin-chat card.
  bot.action('sbp:queue', requireAdmin(), async (ctx) => {
    try {
      const rows = await listPendingSbp(db, SBP_QUEUE_LIMIT);
      await ctx.answerCbQuery();
      if (rows.length === 0) {
        await ctx.reply('🧾 Очередь СБП пуста — ни одной заявки на разборе.', backToHubKeyboard());
        return;
      }
      await ctx.reply(
        rows.length === SBP_QUEUE_LIMIT
          ? `🧾 Заявок СБП набралось — выволок первые ${SBP_QUEUE_LIMIT}, старые сверху.`
          : `🧾 Заявок СБП в очереди: ${rows.length} — ждут вердикта.`,
      );
      for (const row of rows) {
        await ctx.reply(
          [
            `SBP заявка #${row.id}`,
            `Пользователь: ${row.userId} (@${row.username ?? '—'})`,
            `Период: ${row.period ?? '—'}`,
            `Тариф: ${row.subscriptionType ?? '—'}`,
            `Сумма: ${row.amount > 0 ? `${row.amount} ${row.currency}` : '—'}`,
            `Подана: ${row.createdAt.toISOString().slice(0, 10)}`,
          ].join('\n'),
          Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Подтвердить', `sbp:confirm:${row.id}`),
              Markup.button.callback('❌ Отклонить', `sbp:reject:${row.id}`),
            ],
          ]),
        );
      }
    } catch (err) {
      logger.error({ err }, 'sbp queue failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  bot.action(/^pay:hist:(\d+)$/, requireAdmin(), async (ctx) => {
    const raw = ctx.match[1];
    if (!raw) {
      await ctx.answerCbQuery('Кривой запрос — не разобрал');
      return;
    }
    const userId = Number(raw);
    try {
      const rows = await listForUser(db, userId, 10);
      await ctx.answerCbQuery();
      if (rows.length === 0) {
        await ctx.reply(`💳 id:${userId} — в книге платежей пусто.`, backToUserKeyboard(userId));
        return;
      }
      const lines = rows.map((p) => {
        const mark = p.status === 'completed' ? '✅' : p.status === 'pending' ? '⏳' : '❌';
        const date = (p.completedAt ?? p.createdAt).toISOString().slice(0, 10);
        const tier = p.subscriptionType ? `/${p.subscriptionType}` : '';
        return `${mark} #${p.id} ${date} ${p.type}${tier} ${p.period ?? '—'} — ${p.amount} ${p.currency} (${p.source})`;
      });
      await ctx.reply(
        `💳 Книга платежей id:${userId} — последние ${rows.length}:\n${lines.join('\n')}`,
        backToUserKeyboard(userId),
      );
    } catch (err) {
      logger.error({ err, userId }, 'payment history failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });
}

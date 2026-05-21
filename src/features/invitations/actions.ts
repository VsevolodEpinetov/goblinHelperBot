import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { formatPeriod } from '../../shared/period';

import { invitationsCallback } from './schemas';
import { service } from './service';

async function userHasAccess(
  userId: number,
  period: string,
  type: 'regular' | 'plus',
): Promise<boolean> {
  const row = await db('user_groups').where({ user_id: userId, period, type }).first();
  return !!row;
}

export function registerInvitationActions(): void {
  router.on(invitationsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const period = formatPeriod({ year: payload.year, month: payload.month });

    const allowed = await userHasAccess(ctx.from.id, period, payload.tier);
    if (!allowed) {
      await ctx.answerCbQuery?.('Сначала купи доступ через /buy', { show_alert: true });
      return;
    }

    try {
      const result = await service.getOrCreateInvitationLink({
        userId: ctx.from.id,
        period,
        type: payload.tier,
      });
      if (result.status === 'no_chat') {
        await ctx.answerCbQuery?.('Для этого периода ещё не настроен чат.', { show_alert: true });
        return;
      }
      await ctx.answerCbQuery?.();
      await ctx.reply(
        `${result.status === 'existing' ? 'Твоя ссылка' : 'Готово, держи ссылку'}: ${result.link}`,
        { link_preview_options: { is_disabled: true } },
      );
    } catch (err) {
      logger.error({ err, userId: ctx.from.id, period, tier: payload.tier }, 'inviteGet: failed');
      await ctx.answerCbQuery?.('Не удалось создать ссылку. Попробуй позже.', { show_alert: true });
    }
  });
}

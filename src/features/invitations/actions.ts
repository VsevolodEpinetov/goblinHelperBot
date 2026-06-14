import { Markup } from 'telegraf';
import type { Context } from 'telegraf';

import { editOrReply } from '../../core/nav';
import { logger } from '../../core/observability';
import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { formatPeriod } from '../../shared/period';
import { hasAllArchiveAccess } from '../../shared/user-status';
import { homeButton } from '../onboarding/menus';

import { invitePageCallback, joinLinkKeyboard } from './menus';
import { accessiblePeriods, renderJoinLink } from './routes';
import { invitationsCallback } from './schemas';
import { service } from './service';

async function userHasAccess(
  userId: number,
  period: string,
  type: 'regular' | 'plus',
  roles: readonly string[],
): Promise<boolean> {
  // Friends and staff reach every archive without a payment record.
  if (hasAllArchiveAccess(roles)) return true;
  const row = await db('user_groups').where({ user_id: userId, period, type }).first();
  return !!row;
}

export function registerInvitationActions(): void {
  router.on(invitePageCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    if (!(await ensureApprovedMember(ctx as unknown as Context))) return;
    const subs = await accessiblePeriods(ctx.from.id, ctx.state.roles ?? []);
    await ctx.answerCbQuery?.();
    try {
      await ctx.editMessageReplyMarkup(joinLinkKeyboard(subs, payload.p).reply_markup);
    } catch (err) {
      logger.debug({ err, userId: ctx.from.id, page: payload.p }, 'invitePage: edit skipped');
    }
  });

  router.on(invitationsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    if (!(await ensureApprovedMember(ctx as unknown as Context))) return;

    if (payload.a === 'inviteMenu') {
      await ctx.answerCbQuery?.();
      await renderJoinLink(ctx as unknown as Context);
      return;
    }

    if (payload.a === 'inviteMain') {
      const allAccess = hasAllArchiveAccess(ctx.state.roles ?? []);
      const hasAnyPaid =
        allAccess || !!(await db('user_groups').where('user_id', ctx.from.id).first());
      if (!hasAnyPaid) {
        await ctx.answerCbQuery?.(
          '🌑 В главный зал пускают тех, за кем числится хоть один архив. Возьми — и ключ сам тебе принесу.',
          { show_alert: true },
        );
        return;
      }
      try {
        const main = await service.createMainGroupLink(ctx.from.id);
        if (main.status === 'no_main_group') {
          await ctx.answerCbQuery?.(
            '🕯 Главный зал ещё не отстроен — двери пока нет. Загляни позже.',
            {
              show_alert: true,
            },
          );
          return;
        }
        await ctx.answerCbQuery?.();
        await editOrReply(
          ctx,
          '🏰 Держи ключ от главного зала нашего логова. Войти сможешь только ты, но все равно другим не давай. ',
          Markup.inlineKeyboard([
            [Markup.button.url('🏰 Войти в логово', main.link)],
            [
              Markup.button.callback(
                '🚪 Войти в архивы',
                router.encode(invitationsCallback, { a: 'inviteMenu' }),
              ),
            ],
            [homeButton()],
          ]),
        );
      } catch (err) {
        logger.error({ err, userId: ctx.from.id }, 'inviteMain: failed');
        await ctx.answerCbQuery?.('🕯 Ключ не выковался, что-то заело. Попробуй ещё раз позже.', {
          show_alert: true,
        });
      }
      return;
    }

    const period = formatPeriod({ year: payload.year, month: payload.month });

    const allowed = await userHasAccess(ctx.from.id, period, payload.tier, ctx.state.roles ?? []);
    if (!allowed) {
      await ctx.answerCbQuery?.(
        '🌑 Архив за этот цикл луны ты не брал — казна логова пополнения от тебя не видела. Входа не дам: возьми архив кнопкой в меню, тогда и ключ от ворот получишь.',
        { show_alert: true },
      );
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
      await editOrReply(
        ctx,
        `${result.status === 'existing' ? 'Твоя ссылка' : 'Готово, держи ссылку'}: ${result.link}`,
        {
          link_preview_options: { is_disabled: true },
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🚪 Другой месяц',
                router.encode(invitationsCallback, { a: 'inviteMenu' }),
              ),
            ],
            [homeButton()],
          ]),
        },
      );
    } catch (err) {
      logger.error({ err, userId: ctx.from.id, period, tier: payload.tier }, 'inviteGet: failed');
      await ctx.answerCbQuery?.('🕯 Ключ не выковался, что-то заело. Попробуй ещё раз позже.', {
        show_alert: true,
      });
    }
  });
}

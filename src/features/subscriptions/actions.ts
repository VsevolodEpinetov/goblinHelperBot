import type { Context, Scenes } from 'telegraf';

import { logger } from '../../core/observability';
import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { formatPeriod } from '../../shared/period';
import { SBP_SCENE_ID, sendStarsInvoice, type SbpDraft } from '../payments';

import { basePrice, isTestUser, upgradeBaseDelta } from './pricing';
import { openBuyScreen } from './routes';
import { subscriptionsCallback } from './schemas';

const ADMIN_NOTIFICATIONS_CHAT = process.env.ADMIN_NOTIFICATIONS_CHAT ?? '';

export function registerSubscriptionActions(): void {
  router.on(subscriptionsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const isTest = isTestUser(ctx.from.id);

    switch (payload.a) {
      case 'subOpen':
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await openBuyScreen(ctx as unknown as Context);
        await ctx.answerCbQuery?.();
        break;
      case 'subBuy': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'sub', userId: ctx.from.id, period, tier: payload.tier },
            basePrice(payload.tier),
            {
              title: `Месячный архив за ${period}`,
              description: payload.tier === 'plus' ? 'Расширенный' : 'Обычный',
            },
            isTest,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err }, 'subBuy: invoice send failed');
          await ctx.answerCbQuery?.('Не удалось создать счёт', { show_alert: true });
        }
        break;
      }
      case 'subUpgrade': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'upgrade', userId: ctx.from.id, period },
            upgradeBaseDelta(),
            { title: `Расширение архива за ${period}`, description: `${period}` },
            isTest,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err }, 'subUpgrade: invoice send failed');
          await ctx.answerCbQuery?.('Ошибка', { show_alert: true });
        }
        break;
      }
      case 'subSbp': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        const draft: SbpDraft = {
          period,
          tier: payload.tier,
          amount: 0,
          adminChatId: ADMIN_NOTIFICATIONS_CHAT,
        };
        if (!ADMIN_NOTIFICATIONS_CHAT) {
          await ctx.answerCbQuery?.('SBP не настроен', { show_alert: true });
          break;
        }
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(SBP_SCENE_ID, draft as object);
        break;
      }
      case 'ksStars': {
        const { getKickstarterById } = await import('../kickstarters/repo');
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          break;
        }
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'ks', userId: ctx.from.id, kickstarterId: payload.id },
            ks.cost,
            { title: ks.name, description: `Kickstarter #${ks.id}` },
            isTest,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err, ksId: payload.id }, 'ksStars: invoice failed');
          await ctx.answerCbQuery?.('Ошибка', { show_alert: true });
        }
        break;
      }
    }
  });
}

import type { Scenes } from 'telegraf';

import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { formatPeriod } from '../../shared/period';
import { SBP_SCENE_ID, sendStarsInvoice, type SbpDraft } from '../payments';

import { subscriptionsCallback } from './schemas';

// Base prices read from env. Kept as direct env reads to avoid expanding the
// global config surface for variables only used by this feature.
function getBasePrice(tier: 'regular' | 'plus'): number {
  const reg = Number(process.env.REGULAR_PRICE ?? 350);
  const plus = Number(process.env.PLUS_PRICE ?? 1000);
  return tier === 'plus' ? plus : reg;
}

function getTestUserId(): number | undefined {
  const v = process.env.TEST_USER_ID;
  return v ? Number(v) : undefined;
}

const ADMIN_NOTIFICATIONS_CHAT = process.env.ADMIN_NOTIFICATIONS_CHAT ?? '';

export function registerSubscriptionActions(): void {
  router.on(subscriptionsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const testUserId = getTestUserId();
    const isTestUser = testUserId !== undefined && ctx.from.id === testUserId;

    switch (payload.a) {
      case 'subBuy': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'sub', userId: ctx.from.id, period, tier: payload.tier },
            getBasePrice(payload.tier),
            { title: `Подписка ${payload.tier} ${period}`, description: `${period}` },
            isTestUser,
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
          const upgradeDelta = getBasePrice('plus') - getBasePrice('regular');
          await sendStarsInvoice(
            ctx,
            { t: 'upgrade', userId: ctx.from.id, period },
            upgradeDelta,
            { title: `Апгрейд до Plus ${period}`, description: `${period}` },
            isTestUser,
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
            isTestUser,
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

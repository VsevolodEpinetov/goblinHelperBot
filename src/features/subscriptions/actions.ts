import type { Context, Scenes } from 'telegraf';

import { featureConfig } from '../../core/config';
import { logger } from '../../core/observability';
import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { canPayViaSbp } from '../../shared/achievements';
import { currentPeriod, formatPeriod, isHistoricalPeriod } from '../../shared/period';
import { getUserAchievements } from '../achievements/service';
import { SBP_SCENE_ID, sendStarsInvoice, type SbpDraft } from '../payments';

import { basePrice, isTestUser, oldBasePrice, sbpAmountRub, upgradeBaseDelta } from './pricing';
import { getSubscriptionStatus } from './repo';
import { openBuyScreen, openOldArchiveMonth, openOldArchivesList } from './routes';
import { subscriptionsCallback } from './schemas';

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
      case 'subOldList':
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await openOldArchivesList(ctx as unknown as Context, payload.p ?? 0);
        await ctx.answerCbQuery?.();
        break;
      case 'subOldMonth':
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await openOldArchiveMonth(ctx as unknown as Context, payload.year, payload.month);
        await ctx.answerCbQuery?.();
        break;
      case 'subOldBuy': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const period = formatPeriod({ year: payload.year, month: payload.month });
        const status = await getSubscriptionStatus(db, ctx.from.id, period);
        const owned = status.hasPlus || (payload.tier === 'regular' && status.hasRegular);
        if (owned) {
          await ctx.answerCbQuery?.('Этот архив у тебя уже есть', { show_alert: true });
          break;
        }
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'old', userId: ctx.from.id, period, tier: payload.tier },
            oldBasePrice(payload.tier),
            {
              title: `Старый архив за ${period}`,
              description: payload.tier === 'plus' ? 'Расширенный' : 'Обычный',
            },
            isTest,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err }, 'subOldBuy: invoice send failed');
          await ctx.answerCbQuery?.('Не удалось создать счёт', { show_alert: true });
        }
        break;
      }
      case 'subBuy': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        // Stale buy buttons survive the month flip — past months are sold
        // through the old-archives flow at the 3x price, not the fresh one.
        if (isHistoricalPeriod({ year: payload.year, month: payload.month })) {
          await ctx.answerCbQuery?.(
            'Этот месяц уже в старых архивах — цена там втрое дороже. Веду туда.',
            {
              show_alert: true,
            },
          );
          await openOldArchiveMonth(ctx as unknown as Context, payload.year, payload.month);
          break;
        }
        const period = formatPeriod({ year: payload.year, month: payload.month });
        const buyStatus = await getSubscriptionStatus(db, ctx.from.id, period);
        if (buyStatus.hasPlus || (payload.tier === 'regular' && buyStatus.hasRegular)) {
          await ctx.answerCbQuery?.('Этот архив у тебя уже есть', { show_alert: true });
          break;
        }
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
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const period = formatPeriod({ year: payload.year, month: payload.month });
        const upStatus = await getSubscriptionStatus(db, ctx.from.id, period);
        if (upStatus.hasPlus) {
          await ctx.answerCbQuery?.('Расширенный архив у тебя уже есть — второй не продаем', {
            show_alert: true,
          });
          break;
        }
        if (!upStatus.hasRegular) {
          await ctx.answerCbQuery?.(
            'Сначала возьми обычный архив — расширение кладётся только поверх него',
            { show_alert: true },
          );
          break;
        }
        if (isHistoricalPeriod({ year: payload.year, month: payload.month })) {
          await ctx.answerCbQuery?.(
            'Этот месяц уже в старых архивах — расширение там, цена втрое дороже. Веду туда.',
            { show_alert: true },
          );
          await openOldArchiveMonth(ctx as unknown as Context, payload.year, payload.month);
          break;
        }
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
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        // The hidden СБП button is not the gate — re-check the achievement here.
        const achievements = (await getUserAchievements(ctx.from.id)).map((a) => a.type);
        if (!canPayViaSbp(achievements)) {
          await ctx.answerCbQuery?.('СБП тебе пока не открыт — плати звёздами', {
            show_alert: true,
          });
          break;
        }
        const period = formatPeriod({ year: payload.year, month: payload.month });
        const sbpStatus = await getSubscriptionStatus(db, ctx.from.id, period);
        if (sbpStatus.hasPlus || (payload.tier === 'regular' && sbpStatus.hasRegular)) {
          await ctx.answerCbQuery?.('Этот архив у тебя уже есть', { show_alert: true });
          break;
        }
        const adminChat = featureConfig().adminNotificationsChat;
        if (!adminChat) {
          await ctx.answerCbQuery?.('SBP не настроен', { show_alert: true });
          break;
        }
        const kind = period === formatPeriod(currentPeriod()) ? 'sub' : 'old';
        const draft: SbpDraft = {
          period,
          tier: payload.tier,
          kind,
          amount: sbpAmountRub({
            tier: payload.tier,
            kind,
            upgrade: payload.tier === 'plus' && sbpStatus.hasRegular,
          }),
          adminChatId: adminChat,
        };
        await ctx.answerCbQuery?.();
        // Drop the buy-screen buttons so they don't stay live behind the scene prompt.
        try {
          await ctx.editMessageReplyMarkup(undefined);
        } catch {
          /* message may be uneditable; ignore */
        }
        await (ctx as unknown as Scenes.SceneContext).scene.enter(SBP_SCENE_ID, draft as object);
        break;
      }
      case 'ksStars': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
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

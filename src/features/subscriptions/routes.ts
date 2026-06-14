import { Markup } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';

import { editOrReply } from '../../core/nav';
import { requireApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { canPayViaSbp } from '../../shared/achievements';
import { formatPrice } from '../../shared/format';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { getUserAchievements } from '../achievements/service';
import { homeButton } from '../onboarding/menus';

import {
  buyKeyboard,
  OLD_ARCHIVES_PAGE_SIZE,
  oldArchivesKeyboard,
  oldMonthTierKeyboard,
  oldMonthsListKeyboard,
  upgradeKeyboard,
} from './menus';
import { basePrice, finalPrice, isTestUser, oldBasePrice, upgradeBaseDelta } from './pricing';
import { getSubscriptionStatus, listAvailableTiers, listPurchasablePastPeriods } from './repo';
import { subscriptionsCallback } from './schemas';
import { decidePurchaseAction } from './service';

/** Back to the current-month buy screen, plus home. For empty/terminal screens. */
function backToCurrentKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '« К текущему',
        router.encode(subscriptionsCallback, { a: 'subOpen' }),
      ),
    ],
    [homeButton()],
  ]);
}

/** Back to the old-archives list, plus home. For empty/owned month screens. */
function backToOldListKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '« Старые архивы',
        router.encode(subscriptionsCallback, { a: 'subOldList' }),
      ),
    ],
    [homeButton()],
  ]);
}

/**
 * Render the buy screen for the current period. Shared by the /buy command and
 * the «🪙 Взять архив» button (subOpen callback) so members reach it without
 * typing a slash command.
 */
export async function openBuyScreen(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const today = currentPeriod();
  const period = formatPeriod(today);
  const status = await getSubscriptionStatus(db, ctx.from.id, period);
  const decision = decidePurchaseAction({ target: today, today, status });

  const achievements = (await getUserAchievements(ctx.from.id)).map((a) => a.type);
  const sbpAllowed = canPayViaSbp(achievements);
  const priceOpts = {
    yearsOfService: achievements.includes('years_of_service'),
    isTestUser: isTestUser(ctx.from.id),
  };
  const prices = {
    regular: finalPrice(basePrice('regular'), priceOpts),
    plus: finalPrice(basePrice('plus'), priceOpts),
  };
  const upgrade = finalPrice(upgradeBaseDelta(), priceOpts);

  switch (decision.action) {
    case 'already_plus':
      await editOrReply(
        ctx,
        `🔥 Расширенный архив за ${period} весь твой — ни звезды сверху не возьму.`,
        oldArchivesKeyboard(),
      );
      return;
    case 'offer_upgrade':
      await editOrReply(
        ctx,
        `💎 Обычный архив за ${period} уже твой. Хочешь расширенный — докинь ${formatPrice(upgrade, 'XTR')} в казну, и открою тебе вторую дверь.`,
        upgradeKeyboard(today, upgrade),
      );
      return;
    case 'buy_current':
      await editOrReply(
        ctx,
        `🪙 Месячный архив за ${period} ещё не у тебя, гоблин. Выбирай дверь — обычный или расширенный, цена на кнопке. Звёзды в казну — добыча в лапы.`,
        buyKeyboard(today, sbpAllowed, prices),
      );
      return;
    case 'buy_old':
    case 'already_regular_old':
      await editOrReply(
        ctx,
        '🌑 Старые месяцы на полке не держу — достаю их только по запросу. Загляни в старьё по кнопке ниже.',
        oldArchivesKeyboard(),
      );
      return;
  }
}

/** One page of past archives the member can still buy. */
export async function openOldArchivesList(ctx: Context, page = 0): Promise<void> {
  if (!ctx.from) return;
  const current = formatPeriod(currentPeriod());
  // Fetch one extra row beyond the page so hasNext needs no count query.
  const periods = await listPurchasablePastPeriods(
    db,
    current,
    (page + 1) * OLD_ARCHIVES_PAGE_SIZE + 1,
  );
  if (periods.length === 0) {
    await editOrReply(
      ctx,
      '📦 Древностей пока нет — нечего со дна доставать.',
      backToCurrentKeyboard(),
    );
    return;
  }
  const hasNext = periods.length > (page + 1) * OLD_ARCHIVES_PAGE_SIZE;
  const pageRows = periods.slice(
    page * OLD_ARCHIVES_PAGE_SIZE,
    (page + 1) * OLD_ARCHIVES_PAGE_SIZE,
  );
  await editOrReply(
    ctx,
    '📚 Древности с дальних полок. Тыкай, какой архив вытащить. Учти: за такое казна берёт втрое больше против свежего.',
    oldMonthsListKeyboard(pageRows, page, hasNext),
  );
}

/** Show the buyable tiers for one past archive. */
export async function openOldArchiveMonth(
  ctx: Context,
  year: number,
  month: number,
): Promise<void> {
  if (!ctx.from) return;
  const target = { year, month };
  const period = formatPeriod(target);
  const available = await listAvailableTiers(db, period);
  if (available.length === 0) {
    await editOrReply(ctx, '📦 Этого архива нет на полках.', backToOldListKeyboard());
    return;
  }
  const status = await getSubscriptionStatus(db, ctx.from.id, period);
  const achievements = (await getUserAchievements(ctx.from.id)).map((a) => a.type);
  const sbpAllowed = canPayViaSbp(achievements);
  const priceOpts = {
    yearsOfService: achievements.includes('years_of_service'),
    isTestUser: isTestUser(ctx.from.id),
  };
  const offers = status.hasPlus
    ? []
    : available
        .filter((t) => !(t === 'regular' && status.hasRegular))
        .map((t) => ({ tier: t, price: finalPrice(oldBasePrice(t), priceOpts) }));
  if (offers.length === 0) {
    await editOrReply(ctx, `🔥 Архив за ${period} у тебя уже есть.`, backToOldListKeyboard());
    return;
  }
  await editOrReply(
    ctx,
    `🌑 Архив за ${period} поднял. Бери обычный или расширенный — цена древности тройная, на кнопках.`,
    oldMonthTierKeyboard(target, offers, sbpAllowed),
  );
}

export function registerSubscriptionCommands(bot: Telegraf): void {
  bot.command('buy', requireApprovedMember(), (ctx) => openBuyScreen(ctx));
}

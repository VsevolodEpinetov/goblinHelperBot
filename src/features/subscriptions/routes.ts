import type { Context, Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { canPayViaSbp } from '../../shared/achievements';
import { formatPrice } from '../../shared/format';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { getUserAchievements } from '../achievements/service';

import {
  buyKeyboard,
  oldArchivesKeyboard,
  oldMonthTierKeyboard,
  oldMonthsListKeyboard,
  upgradeKeyboard,
} from './menus';
import { basePrice, finalPrice, isTestUser, oldBasePrice, upgradeBaseDelta } from './pricing';
import { getSubscriptionStatus, listAvailableTiers, listPurchasablePastPeriods } from './repo';
import { decidePurchaseAction } from './service';

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
      await ctx.reply(
        `🔥 Расширенный архив за ${period} весь твой — ни звезды сверху не возьму.`,
        oldArchivesKeyboard(),
      );
      return;
    case 'offer_upgrade':
      await ctx.reply(
        `💎 Обычный архив за ${period} уже твой. Хочешь расширенный — докинь ${formatPrice(upgrade, 'XTR')}, и подыму тебя до полной двери.`,
        upgradeKeyboard(today, upgrade),
      );
      return;
    case 'buy_current':
      await ctx.reply(
        `🪙 Месячный архив за ${period} ещё не у тебя, свой. Выбирай дверь и плати звёздами — обычный или расширенный, цена на кнопке.`,
        buyKeyboard(today, sbpAllowed, prices),
      );
      return;
    case 'buy_old':
    case 'already_regular_old':
      await ctx.reply(
        '🌑 Старые месяцы на полке не держу — таскаю их только по запросу. Стукни в совет, скажут библиотекарю — достанет.',
      );
      return;
  }
}

/** List past archives the member can still buy. */
export async function openOldArchivesList(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const current = formatPeriod(currentPeriod());
  const periods = await listPurchasablePastPeriods(db, current);
  if (periods.length === 0) {
    await ctx.reply('📦 Старья пока нет — нечего со дна доставать.');
    return;
  }
  await ctx.reply(
    '📚 Старьё со дна полок. Выбери, какой архив тебе вытащить — старое стоит втрое против свежего.',
    oldMonthsListKeyboard(periods),
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
    await ctx.reply('📦 Этого архива нет на полках.');
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
    await ctx.reply(`🔥 Архив за ${period} у тебя уже есть.`);
    return;
  }
  await ctx.reply(
    `🌑 Архив за ${period} поднял. Бери обычный или расширенный — цена тройная, старьё, на кнопках.`,
    oldMonthTierKeyboard(target, offers, sbpAllowed),
  );
}

export function registerSubscriptionCommands(bot: Telegraf): void {
  bot.command('buy', (ctx) => openBuyScreen(ctx));
}

import type { Context, Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { canPayViaSbp } from '../../shared/achievements';
import { formatPrice } from '../../shared/format';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { getUserAchievements } from '../achievements/service';

import { buyKeyboard, upgradeKeyboard } from './menus';
import { basePrice, finalPrice, isTestUser, upgradeBaseDelta } from './pricing';
import { getSubscriptionStatus } from './repo';
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
      await ctx.reply(`🔥 Расширенный архив за ${period} весь твой — ни звезды сверху не возьму.`);
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

export function registerSubscriptionCommands(bot: Telegraf): void {
  bot.command('buy', (ctx) => openBuyScreen(ctx));
}

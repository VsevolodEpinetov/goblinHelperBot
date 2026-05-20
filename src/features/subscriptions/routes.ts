import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { canPayViaSbp } from '../../shared/achievements';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { getUserAchievements } from '../achievements/service';

import { buyKeyboard, upgradeKeyboard } from './menus';
import { getSubscriptionStatus } from './repo';
import { decidePurchaseAction } from './service';

export function registerSubscriptionCommands(bot: Telegraf): void {
  bot.command('buy', async (ctx) => {
    if (!ctx.from) return;
    const today = currentPeriod();
    const period = formatPeriod(today);
    const status = await getSubscriptionStatus(db, ctx.from.id, period);
    const decision = decidePurchaseAction({ target: today, today, status });

    const achievements = (await getUserAchievements(ctx.from.id)).map((a) => a.type);
    const sbpAllowed = canPayViaSbp(achievements);

    switch (decision.action) {
      case 'already_plus':
        await ctx.reply(`У тебя уже есть Plus за ${period}.`);
        return;
      case 'offer_upgrade':
        await ctx.reply(
          `Регулярная подписка за ${period} уже куплена. Можешь обновиться до Plus.`,
          upgradeKeyboard(today),
        );
        return;
      case 'buy_current':
        await ctx.reply(`Подписка за ${period}:`, buyKeyboard(today, sbpAllowed));
        return;
      case 'buy_old':
      case 'already_regular_old':
        await ctx.reply('Старые месяцы покупаются по запросу. Напиши админу.');
        return;
    }
  });
}

import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { listUserSubscriptions } from '../subscriptions/repo';

import { getLinkInline } from './menus';

export function registerInvitationCommands(bot: Telegraf): void {
  bot.command('joinlink', async (ctx) => {
    if (!ctx.from) return;
    const subs = await listUserSubscriptions(db, ctx.from.id);
    if (subs.length === 0) {
      await ctx.reply('У тебя пока нет купленных периодов.');
      return;
    }
    // Prefer current period if owned; otherwise the most recent.
    const today = currentPeriod();
    const todayPeriod = formatPeriod(today);
    const ownsCurrent = subs.find((s) => s.period === todayPeriod);
    const target = ownsCurrent ?? subs[0]!;

    const [yStr, mStr] = target.period.split('_');
    if (!yStr || !mStr) {
      await ctx.reply('Внутренняя ошибка: неверный период.');
      return;
    }
    const year = Number(yStr);
    const month = Number(mStr);
    await ctx.reply(
      `Запросить ссылку на ${target.period} (${target.tier}):`,
      getLinkInline(year, month, target.tier),
    );
  });
}

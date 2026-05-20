import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';

import { formatKickstarterShort } from './format';
import { listKickstarters, listUserKickstarters } from './repo';

export function registerKickstarterCommands(bot: Telegraf): void {
  bot.command('kickstarters', async (ctx) => {
    const rows = await listKickstarters(db);
    if (rows.length === 0) {
      await ctx.reply('Каталог пуст.');
      return;
    }
    await ctx.reply(rows.map(formatKickstarterShort).join('\n'));
  });

  bot.command('mykickstarters', async (ctx) => {
    if (!ctx.from) return;
    const rows = await listUserKickstarters(db, ctx.from.id);
    if (rows.length === 0) {
      await ctx.reply('Пока ничего не купил.');
      return;
    }
    await ctx.reply(rows.map(formatKickstarterShort).join('\n'));
  });
}

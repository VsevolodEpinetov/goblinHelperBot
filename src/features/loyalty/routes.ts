import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';

import { leaderboardText, profileText } from './menus';
import { getLeaderboard } from './repo';
import { getProfile } from './service';

export function register(bot: Telegraf): void {
  bot.command('profile', async (ctx) => {
    if (!ctx.from) return;
    const profile = await getProfile(ctx.from.id);
    if (!profile) {
      await ctx.reply('У тебя пока нет XP. Активность в группах его даёт.');
      return;
    }
    await ctx.reply(profileText(profile), { parse_mode: 'HTML' });
  });

  bot.command('leaderboard', async (ctx) => {
    const rows = await getLeaderboard(db, 10);
    await ctx.reply(leaderboardText(rows), { parse_mode: 'HTML' });
  });
}

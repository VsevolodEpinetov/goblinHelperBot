import type { Context, Telegraf } from 'telegraf';

import { db } from '../../db/client';

import { leaderboardText, profileText } from './menus';
import { getLeaderboard } from './repo';
import { getProfile } from './service';

/** Render the user's profile card. Shared by /profile and the hub 👤 button. */
export async function renderProfile(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const profile = await getProfile(ctx.from.id);
  if (!profile) {
    await ctx.reply('У тебя пока нет XP. Активность в группах его даёт.');
    return;
  }
  await ctx.reply(profileText(profile), { parse_mode: 'HTML' });
}

/** Render the leaderboard. Shared by /leaderboard and the loyalty callback. */
export async function renderLeaderboard(ctx: Context): Promise<void> {
  const rows = await getLeaderboard(db, 10);
  await ctx.reply(leaderboardText(rows), { parse_mode: 'HTML' });
}

export function register(bot: Telegraf): void {
  bot.command('profile', (ctx) => renderProfile(ctx));
  bot.command('leaderboard', (ctx) => renderLeaderboard(ctx));
}

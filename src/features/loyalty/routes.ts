import type { Context, Telegraf } from 'telegraf';

import { editOrReply } from '../../core/nav';
import { requireApprovedMember } from '../../core/permissions';
import { db } from '../../db/client';
import { getUserAchievements } from '../achievements';
import { getUserScrolls } from '../scrolls';
import { listUserSubscriptions } from '../subscriptions/repo';

import { leaderboardKeyboard, leaderboardText, profileKeyboard, profileText } from './menus';
import { getLeaderboard, getUserRank } from './repo';
import { getProfile } from './service';

/** Render the user's profile card. Shared by /profile and the hub 👤 button. */
export async function renderProfile(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const profile = await getProfile(ctx.from.id);
  if (!profile) {
    await editOrReply(
      ctx,
      'У тебя пока нет опыта. Шурши в группах и он сам накопится.',
      profileKeyboard(),
    );
    return;
  }
  // Surface the hidden ledgers on the card: achievements drive subscription
  // discounts, scrolls pay for kickstarters, and owned archives are otherwise
  // only visible as the key list — members must be able to see all three.
  const [achievements, scrolls, subs] = await Promise.all([
    getUserAchievements(ctx.from.id),
    getUserScrolls(db, ctx.from.id),
    listUserSubscriptions(db, ctx.from.id),
  ]);
  const scrollCount = scrolls.reduce((sum, s) => sum + s.amount, 0);
  const archiveCount = new Set(subs.map((s) => s.period)).size;
  await editOrReply(
    ctx,
    profileText({
      ...profile,
      achievements: achievements.map((a) => a.displayName),
      scrollCount,
      archiveCount,
    }),
    { parse_mode: 'HTML', ...profileKeyboard() },
  );
}

/** Render the leaderboard. Shared by /leaderboard and the loyalty callback. */
export async function renderLeaderboard(ctx: Context): Promise<void> {
  const [rows, viewerRank] = await Promise.all([
    getLeaderboard(db, 10),
    ctx.from ? getUserRank(db, ctx.from.id) : Promise.resolve(null),
  ]);
  await editOrReply(ctx, leaderboardText(rows, ctx.from?.id, viewerRank), {
    parse_mode: 'HTML',
    ...leaderboardKeyboard(),
  });
}

export function register(bot: Telegraf): void {
  bot.command('profile', requireApprovedMember(), (ctx) => renderProfile(ctx));
  bot.command('leaderboard', requireApprovedMember(), (ctx) => renderLeaderboard(ctx));
}

import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { escapeHtml, formatUserDisplay } from '../../shared/format';
import { tierByName } from '../../shared/loyalty-config';
import { homeButton } from '../onboarding/menus';

import type { LeaderboardEntry } from './repo';
import { loyaltyCallback } from './schemas';

/** Profile card nav: jump to the leaderboard or back to the hub. */
export function profileKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🏆 Лучшие в логове',
        router.encode(loyaltyCallback, { a: 'leaders' }),
      ),
    ],
    [homeButton()],
  ]);
}

/** Leaderboard nav: jump to your own profile or back to the hub. */
export function leaderboardKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👤 Профиль', router.encode(loyaltyCallback, { a: 'profile' }))],
    [homeButton()],
  ]);
}

export function profileText(profile: {
  totalXp: number;
  tier: { name: string; displayName: string; emoji: string };
  level: number;
  xpToNextLevel: number;
  nextTierXp: number | null;
  achievements: readonly string[];
  scrollCount: number;
  archiveCount: number;
}): string {
  const lines = [
    `${profile.tier.emoji} <b>${profile.tier.displayName}</b> — уровень ${profile.level}`,
    `Опыт: <code>${profile.totalXp}</code>`,
  ];
  if (profile.nextTierXp !== null) {
    lines.push(`До следующего уровня: ${profile.xpToNextLevel} опыта`);
  }
  lines.push(
    profile.achievements.length > 0
      ? `🏅 Заслуги от совета: ${profile.achievements.map(escapeHtml).join(', ')}`
      : '🏅 Заслуг нет — совет твоих подвигов пока не видел.',
    profile.scrollCount > 0
      ? `📜 Свитки: ${profile.scrollCount} — трать на кикстартеры.`
      : '📜 Свитков нет — заслужи у совета.',
    profile.archiveCount > 0
      ? `🗝 Твоя добыча: архивов — ${profile.archiveCount}. Ключи от них живут за кнопкой «🚪 Ключ от ворот».`
      : '🕸 Архивов за тобой пока нет — сундук пуст. Плати звёзды в казну, будет и добыча.',
  );
  return lines.join('\n');
}

export function leaderboardText(
  rows: LeaderboardEntry[],
  viewerId?: number,
  viewerRank?: { rank: number; totalXp: number } | null,
): string {
  if (rows.length === 0) return 'Пока пусто — никто ещё опыта не натаскал.';
  const lines = rows.map((r, i) => {
    const tier = tierByName(r.currentTier);
    const emoji = tier?.emoji ?? '•';
    const name = escapeHtml(
      formatUserDisplay({
        id: r.userId,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
      }),
    );
    const you = viewerId !== undefined && r.userId === viewerId ? ' ← это ты' : '';
    return `${i + 1}. ${emoji} ${name} — ${r.totalXp} опыта${you}`;
  });
  // The viewer's own standing, so the screen is never just other people's glory.
  if (viewerId !== undefined && !rows.some((r) => r.userId === viewerId)) {
    lines.push(
      '',
      viewerRank
        ? `👁‍🗨 Твоё место в стае — ${viewerRank.rank}-е, опыта набрал ${viewerRank.totalXp}. До верхушки ещё карабкаться.`
        : '🕯 А тебя в этом списке нет — следов не оставил. Подай голос в чатах логова: опыт капает за каждое слово.',
    );
  }
  return lines.join('\n');
}

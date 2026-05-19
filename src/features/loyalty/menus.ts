import { tierByName } from '../../shared/loyalty-config';

import type { LeaderboardEntry } from './repo';

export function profileText(profile: {
  totalXp: number;
  tier: { name: string; displayName: string; emoji: string };
  level: number;
  xpToNextLevel: number;
  nextTierXp: number | null;
}): string {
  const lines = [
    `${profile.tier.emoji} <b>${profile.tier.displayName}</b> — уровень ${profile.level}`,
    `XP: <code>${profile.totalXp}</code>`,
  ];
  if (profile.nextTierXp !== null) {
    lines.push(`До следующего уровня: ${profile.xpToNextLevel} XP`);
  }
  return lines.join('\n');
}

export function leaderboardText(rows: LeaderboardEntry[]): string {
  if (rows.length === 0) return 'Пока пусто.';
  return rows
    .map((r, i) => {
      const tier = tierByName(r.currentTier);
      const emoji = tier?.emoji ?? '•';
      const name = r.username
        ? `@${r.username}`
        : [r.firstName, r.lastName].filter(Boolean).join(' ') || `id:${r.userId}`;
      return `${i + 1}. ${emoji} ${name} — ${r.totalXp} XP`;
    })
    .join('\n');
}

export interface Tier {
  /** Stable identifier used across the codebase (was `devName` in the JS config). */
  name: string;
  /** User-facing display name in Russian. */
  displayName: string;
  /** Emoji shown next to the tier. */
  emoji: string;
  /** Inclusive lower XP boundary. */
  xpMin: number;
  /** Inclusive upper XP boundary, or null for the top tier. */
  xpMax: number | null;
  /** Number of sub-levels within the tier (null for the open-ended top tier). */
  levels: number | null;
  /** XP per level for the open-ended top tier only. */
  levelStep?: number;
}

/**
 * Canonical tier list — single source of truth for the rewrite.
 * Ported from configs/rpg.js. Manual overrides via the deprecated
 * userLoyalty table are removed in the rewrite.
 */
export const TIERS: readonly Tier[] = [
  {
    name: 'wood',
    displayName: 'Деревянный',
    emoji: '🪵',
    xpMin: 0,
    xpMax: 1999,
    levels: 10,
  },
  {
    name: 'bronze',
    displayName: 'Бронзовый',
    emoji: '🥉',
    xpMin: 2000,
    xpMax: 4999,
    levels: 10,
  },
  {
    name: 'silver',
    displayName: 'Серебряный',
    emoji: '🥈',
    xpMin: 5000,
    xpMax: 9999,
    levels: 10,
  },
  {
    name: 'gold',
    displayName: 'Золотой',
    emoji: '🥇',
    xpMin: 10000,
    xpMax: 19999,
    levels: 10,
  },
  {
    name: 'platinum',
    displayName: 'Платиновый',
    emoji: '💎',
    xpMin: 20000,
    xpMax: 39999,
    levels: 10,
  },
  {
    name: 'diamond',
    displayName: 'Алмазный',
    emoji: '💠',
    xpMin: 40000,
    xpMax: 79999,
    levels: 10,
  },
  {
    name: 'mithril',
    displayName: 'Мифриловый',
    emoji: '⚔️',
    xpMin: 80000,
    xpMax: 159999,
    levels: 10,
  },
  {
    name: 'legend',
    displayName: 'Легендарный',
    emoji: '👑',
    xpMin: 160000,
    xpMax: null,
    levels: null,
    levelStep: 10000,
  },
] as const;

export function getTierByXp(xp: number): Tier {
  const clamped = Math.max(0, xp);
  let current: Tier = TIERS[0]!;
  for (const tier of TIERS) {
    if (clamped >= tier.xpMin) current = tier;
    else break;
  }
  return current;
}

export function tierByName(name: string): Tier | undefined {
  return TIERS.find((t) => t.name === name);
}

export function getNextTier(currentName: string): Tier | null {
  const idx = TIERS.findIndex((t) => t.name === currentName);
  if (idx < 0 || idx === TIERS.length - 1) return null;
  return TIERS[idx + 1]!;
}

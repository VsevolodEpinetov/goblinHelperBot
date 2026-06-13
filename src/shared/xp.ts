import { getNextTier, getTierByXp, type Tier } from './loyalty-config';

export interface Rank {
  /** Tier the user is currently in. */
  tier: Tier;
  /** 1-based level within the tier. */
  level: number;
  /** XP needed to reach the next level. */
  xpToNextLevel: number;
  /** Minimum XP of the next tier, or null if at top tier. */
  nextTierXp: number | null;
}

/**
 * Calculate a user's full rank from total XP.
 *
 * Mirrors the existing JS algorithm in configs/rpg.js::calculateRankFromXp
 * so visible levels stay stable across the rewrite cutover.
 */
export function computeRank(totalXp: number): Rank {
  const xp = Math.max(0, totalXp);
  const tier = getTierByXp(xp);
  const next = getNextTier(tier.name);

  if (tier.xpMax === null) {
    // Open-ended top tier: each `levelStep` XP is one level.
    const step = tier.levelStep ?? 10000;
    const extra = Math.max(0, xp - tier.xpMin);
    const level = 1 + Math.floor(extra / step);
    const xpIntoLevel = extra % step;
    const xpToNextLevel = step - xpIntoLevel;
    return { tier, level, xpToNextLevel, nextTierXp: null };
  }

  // Finite tier: xpRange divided into `tier.levels` even slices.
  const xpRange = tier.xpMax - tier.xpMin + 1;
  const levels = tier.levels ?? 1;
  const xpPerLevel = xpRange / levels;
  const xpIntoTier = Math.max(0, xp - tier.xpMin);
  const level = Math.min(levels, Math.floor(xpIntoTier / xpPerLevel) + 1);
  const xpIntoLevel = xpIntoTier % xpPerLevel;
  const xpToNextLevel =
    level === levels
      ? tier.xpMax - xp // last level in tier: XP until next tier
      : Math.ceil(xpPerLevel - xpIntoLevel);

  return {
    tier,
    level,
    xpToNextLevel,
    nextTierXp: next ? next.xpMin : null,
  };
}

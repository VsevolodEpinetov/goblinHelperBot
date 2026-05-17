import { describe, expect, it } from 'vitest';

import { TIERS, tierByName } from './loyalty-config';
import { computeRank, xpForSpending } from './xp';

describe('xp', () => {
  describe('xpForSpending', () => {
    it('converts spending units to XP using the 1.3 multiplier', () => {
      expect(xpForSpending(100)).toBe(130);
    });

    it('rounds down when the result is fractional', () => {
      // 7 * 1.3 = 9.1 → 9
      expect(xpForSpending(7)).toBe(9);
    });

    it('returns 0 for 0 spending', () => {
      expect(xpForSpending(0)).toBe(0);
    });

    it('throws on negative spending', () => {
      expect(() => xpForSpending(-5)).toThrow(/non-negative/);
    });
  });

  describe('computeRank', () => {
    it('returns wood tier level 1 for 0 xp', () => {
      const rank = computeRank(0);
      expect(rank.tier.name).toBe('wood');
      expect(rank.level).toBe(1);
    });

    it('returns wood tier highest level near the upper boundary', () => {
      // wood: 0..1999 over 10 levels → 200 xp per level
      const rank = computeRank(1999);
      expect(rank.tier.name).toBe('wood');
      expect(rank.level).toBe(10);
    });

    it('jumps to bronze at exactly 2000 xp', () => {
      const rank = computeRank(2000);
      expect(rank.tier.name).toBe('bronze');
      expect(rank.level).toBe(1);
    });

    it('places gold tier user at the expected level', () => {
      // gold: 10000..19999 over 10 levels → 1000 xp per level
      // 14500 xp → 4500 into tier → level floor(4500/1000)+1 = 5
      const rank = computeRank(14500);
      expect(rank.tier.name).toBe('gold');
      expect(rank.level).toBe(5);
    });

    it('reports xpToNextLevel mid-level', () => {
      // gold @ 14500: 500 xp into level 5 → 500 xp to level 6
      const rank = computeRank(14500);
      expect(rank.xpToNextLevel).toBe(500);
    });

    it('handles the legend tier (open-ended)', () => {
      // legend: starts at 160000, levelStep 10000
      // 175000 xp → 15000 into tier → level 2; 5000 xp into level
      const rank = computeRank(175000);
      expect(rank.tier.name).toBe('legend');
      expect(rank.level).toBe(2);
      expect(rank.xpToNextLevel).toBe(5000);
    });

    it('nextTierXp is null at the legend tier', () => {
      expect(computeRank(200000).nextTierXp).toBeNull();
    });

    it('nextTierXp reports the next tier minXp below the top tier', () => {
      const rank = computeRank(500);
      expect(rank.nextTierXp).toBe(tierByName('bronze')!.xpMin);
    });

    it('clamps negative xp to wood level 1', () => {
      const rank = computeRank(-100);
      expect(rank.tier.name).toBe('wood');
      expect(rank.level).toBe(1);
    });
  });

  it('every tier produces a valid rank at its lower boundary', () => {
    for (const tier of TIERS) {
      const rank = computeRank(tier.xpMin);
      expect(rank.tier.name).toBe(tier.name);
      expect(rank.level).toBe(1);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { TIERS, getNextTier, getTierByXp, tierByName } from './loyalty-config';

describe('loyalty-config', () => {
  it('exposes 8 tiers (wood → legend)', () => {
    expect(TIERS).toHaveLength(8);
    expect(TIERS[0]!.name).toBe('wood');
    expect(TIERS[7]!.name).toBe('legend');
  });

  it('tiers are in ascending xpMin order', () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i]!.xpMin).toBeGreaterThan(TIERS[i - 1]!.xpMin);
    }
  });

  it('first tier starts at 0 xp, last tier has no xpMax', () => {
    expect(TIERS[0]!.xpMin).toBe(0);
    expect(TIERS[7]!.xpMax).toBeNull();
  });

  it('every tier has the required fields populated', () => {
    for (const tier of TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.displayName).toBeTruthy();
      expect(tier.emoji).toBeTruthy();
    }
  });

  it('the legend tier has levelStep set; others have finite levels', () => {
    const legend = TIERS[7]!;
    expect(legend.levels).toBeNull();
    expect(legend.levelStep).toBe(10000);
    for (let i = 0; i < TIERS.length - 1; i += 1) {
      expect(TIERS[i]!.levels).toBe(10);
      expect(TIERS[i]!.levelStep).toBeUndefined();
    }
  });

  describe('getTierByXp', () => {
    it('returns wood for 0 xp', () => {
      expect(getTierByXp(0).name).toBe('wood');
    });

    it('returns bronze at 2000 xp (lower boundary)', () => {
      expect(getTierByXp(2000).name).toBe('bronze');
    });

    it('returns wood at 1999 xp (one below bronze)', () => {
      expect(getTierByXp(1999).name).toBe('wood');
    });

    it('returns legend at 160000 and above', () => {
      expect(getTierByXp(160000).name).toBe('legend');
      expect(getTierByXp(1_000_000).name).toBe('legend');
    });

    it('clamps negative xp to wood', () => {
      expect(getTierByXp(-50).name).toBe('wood');
    });
  });

  describe('tierByName', () => {
    it('returns the tier for a known devName', () => {
      expect(tierByName('gold')).toBe(TIERS.find((t) => t.name === 'gold'));
    });

    it('returns undefined for an unknown name', () => {
      expect(tierByName('does-not-exist')).toBeUndefined();
    });
  });

  describe('getNextTier', () => {
    it('returns the tier above the given one', () => {
      expect(getNextTier('wood')?.name).toBe('bronze');
      expect(getNextTier('mithril')?.name).toBe('legend');
    });

    it('returns null at the top tier', () => {
      expect(getNextTier('legend')).toBeNull();
    });

    it('returns null for an unknown tier name', () => {
      expect(getNextTier('nope')).toBeNull();
    });
  });
});

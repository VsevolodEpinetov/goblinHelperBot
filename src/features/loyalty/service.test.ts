import { describe, expect, it } from 'vitest';

import { detectLevelUp } from './service';

describe('loyalty.service.detectLevelUp', () => {
  it('returns null when neither tier nor level changed', () => {
    expect(detectLevelUp({ tier: 'wood', level: 3 }, { tier: 'wood', level: 3 })).toBeNull();
  });

  it('reports a level-up within the same tier', () => {
    const out = detectLevelUp({ tier: 'wood', level: 3 }, { tier: 'wood', level: 4 });
    expect(out).toEqual({ type: 'level', from: 3, to: 4, tier: 'wood' });
  });

  it('reports a tier promotion', () => {
    const out = detectLevelUp({ tier: 'wood', level: 10 }, { tier: 'bronze', level: 1 });
    expect(out).toEqual({ type: 'tier', fromTier: 'wood', toTier: 'bronze', toLevel: 1 });
  });

  it('reports a tier promotion even if level is non-1 after the jump', () => {
    const out = detectLevelUp({ tier: 'silver', level: 5 }, { tier: 'gold', level: 2 });
    expect(out).toEqual({ type: 'tier', fromTier: 'silver', toTier: 'gold', toLevel: 2 });
  });
});

import { describe, expect, it } from 'vitest';

import { isKsDelegate, isKsManager } from './constants';

describe('kickstarters.constants role predicates', () => {
  it('treats adminKs as both a delegate and a manager', () => {
    expect(isKsDelegate(['goblin', 'adminKs'])).toBe(true);
    expect(isKsManager(['goblin', 'adminKs'])).toBe(true);
  });

  it('treats admin ranks as managers but NOT delegates (they use the admin hub)', () => {
    for (const rank of ['admin', 'adminPlus', 'super']) {
      expect(isKsManager([rank])).toBe(true);
      expect(isKsDelegate([rank])).toBe(false);
    }
  });

  it('denies plain members and unrelated roles', () => {
    expect(isKsManager(['goblin', 'polls'])).toBe(false);
    expect(isKsDelegate(['goblin', 'polls'])).toBe(false);
    expect(isKsManager([])).toBe(false);
  });
});

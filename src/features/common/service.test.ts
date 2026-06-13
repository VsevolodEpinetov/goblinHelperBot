import { describe, expect, it } from 'vitest';

import { rollDice } from './service';

describe('common.service.rollDice', () => {
  it('returns an integer between 1 and max (inclusive) for valid input', () => {
    for (let i = 0; i < 100; i += 1) {
      const result = rollDice(6);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('returns 1 when max is 1', () => {
    expect(rollDice(1)).toBe(1);
  });

  it('throws on max < 1', () => {
    expect(() => rollDice(0)).toThrow();
    expect(() => rollDice(-5)).toThrow();
  });

  it('throws on non-integer max', () => {
    expect(() => rollDice(2.5)).toThrow();
  });

  it('caps max at a sane upper bound', () => {
    expect(() => rollDice(1_000_001)).toThrow(/maximum/i);
  });
});

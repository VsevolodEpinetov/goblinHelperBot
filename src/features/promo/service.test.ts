import { describe, expect, it } from 'vitest';

import { formatTimeRemaining, computeCooldownUntil, COOLDOWN_HOURS } from './service';

describe('promo.service.formatTimeRemaining', () => {
  it('formats hours and minutes', () => {
    const future = new Date(Date.now() + (2 * 60 + 30) * 60_000);
    expect(formatTimeRemaining(future)).toBe('2ч 30м');
  });

  it('formats minutes only when under an hour', () => {
    const future = new Date(Date.now() + 45 * 60_000);
    expect(formatTimeRemaining(future)).toBe('45м');
  });

  it('returns "0 минут" when already past', () => {
    const past = new Date(Date.now() - 1000);
    expect(formatTimeRemaining(past)).toBe('0 минут');
  });
});

describe('promo.service.computeCooldownUntil', () => {
  it('is exactly COOLDOWN_HOURS in the future', () => {
    const now = new Date(2026, 4, 17, 12, 0, 0);
    const until = computeCooldownUntil(now);
    expect(until.getTime() - now.getTime()).toBe(COOLDOWN_HOURS * 3600_000);
  });
});

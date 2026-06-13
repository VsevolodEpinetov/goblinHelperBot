import { describe, expect, it } from 'vitest';

import { computePrice } from './pricing';

describe('pricing', () => {
  describe('computePrice', () => {
    it('returns the base price for a regular user with no discount and no test override', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: false,
        isTestUser: false,
      });
      expect(result.final).toBe(1000);
      expect(result.discountPercent).toBe(0);
      expect(result.source.testOverride).toBe(false);
    });

    it('applies the 50% years-of-service discount when eligible', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: true,
        isTestUser: false,
      });
      expect(result.final).toBe(500);
      expect(result.discountPercent).toBe(50);
      expect(result.source.yearsOfService).toBe(true);
    });

    it('rounds the discounted price to the nearest integer', () => {
      const result = computePrice({
        basePrice: 999,
        yearsOfService: true,
        isTestUser: false,
      });
      // 999 * 0.5 = 499.5 → 500 (Math.round, banker's rounding behavior on .5)
      expect(result.final).toBe(500);
    });

    it('applies the test-user override regardless of other inputs', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: true,
        isTestUser: true,
      });
      expect(result.final).toBe(1);
      expect(result.source.testOverride).toBe(true);
    });

    it('handles a zero base price by returning zero', () => {
      const result = computePrice({
        basePrice: 0,
        yearsOfService: false,
        isTestUser: false,
      });
      expect(result.final).toBe(0);
    });

    it('does not allow a negative base price', () => {
      expect(() =>
        computePrice({ basePrice: -10, yearsOfService: false, isTestUser: false }),
      ).toThrow(/non-negative/);
    });

    it('discount percent is reported even when test override fires', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: true,
        isTestUser: true,
      });
      expect(result.discountPercent).toBe(50);
      expect(result.final).toBe(1);
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  currentPeriod,
  formatPeriod,
  isHistoricalPeriod,
  parsePeriod,
  periodFromDate,
} from './period';

describe('period', () => {
  describe('periodFromDate', () => {
    it('returns year and month for a given date', () => {
      const period = periodFromDate(new Date('2026-05-17T10:00:00Z'));
      expect(period).toEqual({ year: 2026, month: 5 });
    });

    it('returns month=1 for January', () => {
      const period = periodFromDate(new Date('2026-01-01T00:00:00Z'));
      expect(period).toEqual({ year: 2026, month: 1 });
    });

    it('returns month=12 for December', () => {
      const period = periodFromDate(new Date('2026-12-31T23:59:59Z'));
      expect(period).toEqual({ year: 2026, month: 12 });
    });
  });

  describe('formatPeriod', () => {
    it('formats period as YYYY_MM with zero-padded month', () => {
      expect(formatPeriod({ year: 2026, month: 5 })).toBe('2026_05');
    });

    it('does not pad two-digit months', () => {
      expect(formatPeriod({ year: 2026, month: 12 })).toBe('2026_12');
    });
  });

  describe('parsePeriod', () => {
    it('parses YYYY_MM string into period object', () => {
      expect(parsePeriod('2026_05')).toEqual({ year: 2026, month: 5 });
    });

    it('parses YYYY_MM with single-digit month', () => {
      expect(parsePeriod('2026_5')).toEqual({ year: 2026, month: 5 });
    });

    it('throws on malformed input', () => {
      expect(() => parsePeriod('bogus')).toThrow();
      expect(() => parsePeriod('2026')).toThrow();
      expect(() => parsePeriod('2026_13')).toThrow();
      expect(() => parsePeriod('2026_0')).toThrow();
    });
  });

  describe('isHistoricalPeriod', () => {
    const today = { year: 2026, month: 5 };

    it('returns false for the current period', () => {
      expect(isHistoricalPeriod({ year: 2026, month: 5 }, today)).toBe(false);
    });

    it('returns false for future periods', () => {
      expect(isHistoricalPeriod({ year: 2026, month: 6 }, today)).toBe(false);
      expect(isHistoricalPeriod({ year: 2027, month: 1 }, today)).toBe(false);
    });

    it('returns true for past periods within the same year', () => {
      expect(isHistoricalPeriod({ year: 2026, month: 4 }, today)).toBe(true);
    });

    it('returns true for past years', () => {
      expect(isHistoricalPeriod({ year: 2025, month: 12 }, today)).toBe(true);
      expect(isHistoricalPeriod({ year: 2024, month: 6 }, today)).toBe(true);
    });
  });

  describe('currentPeriod', () => {
    it('returns a period object derived from the current date', () => {
      const period = currentPeriod();
      expect(period.year).toBeGreaterThanOrEqual(2026);
      expect(period.month).toBeGreaterThanOrEqual(1);
      expect(period.month).toBeLessThanOrEqual(12);
    });
  });
});

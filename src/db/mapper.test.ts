import { describe, expect, it } from 'vitest';

import { fromDbRow, toDbRow, snakeKey, camelKey } from './mapper';

describe('mapper', () => {
  describe('snakeKey / camelKey', () => {
    it('converts camelCase to snake_case', () => {
      expect(snakeKey('userId')).toBe('user_id');
      expect(snakeKey('createdAt')).toBe('created_at');
      expect(snakeKey('telegramPaymentChargeId')).toBe('telegram_payment_charge_id');
      expect(snakeKey('id')).toBe('id');
    });

    it('converts snake_case to camelCase', () => {
      expect(camelKey('user_id')).toBe('userId');
      expect(camelKey('created_at')).toBe('createdAt');
      expect(camelKey('telegram_payment_charge_id')).toBe('telegramPaymentChargeId');
      expect(camelKey('id')).toBe('id');
    });
  });

  describe('fromDbRow', () => {
    it('maps a snake_case row to camelCase', () => {
      expect(fromDbRow({ user_id: 1, created_at: 'now' })).toEqual({
        userId: 1,
        createdAt: 'now',
      });
    });

    it('passes through values unchanged', () => {
      const date = new Date(0);
      expect(fromDbRow({ created_at: date })).toEqual({ createdAt: date });
    });

    it('returns null/undefined inputs as-is', () => {
      expect(fromDbRow(null)).toBeNull();
      expect(fromDbRow(undefined)).toBeUndefined();
    });
  });

  describe('toDbRow', () => {
    it('maps a camelCase object to snake_case', () => {
      expect(toDbRow({ userId: 1, createdAt: 'now' })).toEqual({
        user_id: 1,
        created_at: 'now',
      });
    });

    it('does not include undefined values', () => {
      expect(toDbRow({ userId: 1, email: undefined })).toEqual({ user_id: 1 });
    });
  });
});

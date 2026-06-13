import { describe, expect, it } from 'vitest';

import { escapeHtml, formatPrice, formatUserDisplay, truncate } from './format';

describe('format', () => {
  describe('escapeHtml', () => {
    it('escapes ampersands, angle brackets, and quotes', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
      expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;');
    });

    it('leaves safe strings unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('truncate', () => {
    it('leaves short strings unchanged', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('leaves exact-length strings unchanged', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('truncates longer strings with an ellipsis, staying within max', () => {
      const out = truncate('abcdefghij', 5);
      expect(out).toBe('abcd…');
      expect(out.length).toBe(5);
    });
  });

  describe('formatPrice', () => {
    it('formats stars as the price with XTR symbol', () => {
      expect(formatPrice(500, 'XTR')).toBe('500 ⭐');
    });

    it('formats rubles with the ruble sign', () => {
      expect(formatPrice(1500, 'RUB')).toBe('1500 ₽');
    });

    it('inserts thousand separators when amount is large', () => {
      expect(formatPrice(15000, 'RUB')).toBe('15 000 ₽');
    });
  });

  describe('formatUserDisplay', () => {
    it('uses @username when set and not "not_set"', () => {
      expect(
        formatUserDisplay({
          id: 1,
          username: 'goblin_user',
          firstName: 'Goblin',
          lastName: 'User',
        }),
      ).toBe('@goblin_user');
    });

    it('falls back to first+last name when username is not_set', () => {
      expect(
        formatUserDisplay({
          id: 1,
          username: 'not_set',
          firstName: 'Иван',
          lastName: 'Петров',
        }),
      ).toBe('Иван Петров');
    });

    it('falls back to first name only when no last name', () => {
      expect(
        formatUserDisplay({
          id: 1,
          username: 'not_set',
          firstName: 'Иван',
          lastName: null,
        }),
      ).toBe('Иван');
    });

    it('falls back to id when nothing else is available', () => {
      expect(
        formatUserDisplay({
          id: 42,
          username: 'not_set',
          firstName: null,
          lastName: null,
        }),
      ).toBe('id:42');
    });
  });
});

import { describe, expect, it } from 'vitest';

import { parseUserQuery, parseBalanceInput, parsePeriodKey } from './service';

describe('admin.service.parseUserQuery', () => {
  it('strips leading @ and trims', () => {
    expect(parseUserQuery('  @alice  ')).toBe('alice');
  });
  it('returns id-shaped numeric strings as-is', () => {
    expect(parseUserQuery('12345')).toBe('12345');
  });
  it('rejects empty', () => {
    expect(() => parseUserQuery('')).toThrow();
  });
});

describe('admin.service.parseBalanceInput', () => {
  it('parses integer balances', () => {
    expect(parseBalanceInput('1500')).toBe(1500);
  });
  it('parses negative balances (for deductions)', () => {
    expect(parseBalanceInput('-50')).toBe(-50);
  });
  it('throws on non-numeric', () => {
    expect(() => parseBalanceInput('abc')).toThrow();
  });
});

describe('admin.service.parsePeriodKey', () => {
  it('accepts YYYY_MM', () => {
    expect(parsePeriodKey('2026_05')).toEqual({ year: 2026, month: 5 });
  });
  it('rejects malformed', () => {
    expect(() => parsePeriodKey('bogus')).toThrow();
  });
});

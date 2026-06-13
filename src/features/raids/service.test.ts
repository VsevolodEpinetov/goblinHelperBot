import { describe, expect, it } from 'vitest';

import {
  parseRaidDate,
  validateRaidDescription,
  validateRaidPrice,
  validateRaidTitle,
} from './service';

describe('raids.service.parseRaidDate', () => {
  it('parses DD.MM.YYYY', () => {
    const d = parseRaidDate('31.12.2026');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(11);
    expect(d!.getUTCDate()).toBe(31);
  });

  it('parses DD.MM by attaching the current year', () => {
    const today = new Date();
    const d = parseRaidDate(`15.06`, today);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBeGreaterThanOrEqual(today.getUTCFullYear());
  });

  it('rolls forward to next year if the parsed date is in the past', () => {
    const reference = new Date('2026-06-15T00:00:00Z');
    const d = parseRaidDate('15.01', reference);
    expect(d!.getUTCFullYear()).toBe(2027);
  });

  it('returns null on malformed input', () => {
    expect(parseRaidDate('not-a-date')).toBeNull();
    expect(parseRaidDate('32.13.2026')).toBeNull();
    expect(parseRaidDate('')).toBeNull();
  });
});

describe('raids.service.validateRaidTitle', () => {
  it('accepts non-empty trimmed strings up to 255 chars', () => {
    expect(validateRaidTitle('Hello')).toBe('Hello');
  });

  it('trims whitespace', () => {
    expect(validateRaidTitle('   Hi   ')).toBe('Hi');
  });

  it('throws on empty', () => {
    expect(() => validateRaidTitle('')).toThrow();
    expect(() => validateRaidTitle('   ')).toThrow();
  });

  it('throws on too-long', () => {
    expect(() => validateRaidTitle('a'.repeat(300))).toThrow(/255/);
  });
});

describe('raids.service.validateRaidDescription', () => {
  it('accepts 10–2000 chars', () => {
    expect(validateRaidDescription('a'.repeat(100))).toBe('a'.repeat(100));
  });

  it('throws on too short', () => {
    expect(() => validateRaidDescription('hi')).toThrow();
  });

  it('throws on too long', () => {
    expect(() => validateRaidDescription('a'.repeat(2001))).toThrow();
  });
});

describe('raids.service.validateRaidPrice', () => {
  it('parses integer prices', () => {
    expect(validateRaidPrice('1500')).toBe(1500);
  });

  it('parses decimal prices', () => {
    expect(validateRaidPrice('1500.50')).toBe(1500.5);
  });

  it('throws on negative', () => {
    expect(() => validateRaidPrice('-50')).toThrow();
  });

  it('throws on non-numeric', () => {
    expect(() => validateRaidPrice('abc')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import {
  assertCanModerateRole,
  normalizePeriodInput,
  parseTier,
  parseUserQuery,
  parseBalanceInput,
  parsePeriodKey,
  tierWord,
  type RoleParty,
} from './service';

describe('admin.service.normalizePeriodInput (/this_is period parsing)', () => {
  it('accepts assorted separators and canonicalizes to YYYY_MM', () => {
    expect(normalizePeriodInput('2026_05')).toBe('2026_05');
    expect(normalizePeriodInput('2026-05')).toBe('2026_05');
    expect(normalizePeriodInput('2026.5')).toBe('2026_05');
    expect(normalizePeriodInput('2026/05')).toBe('2026_05');
    expect(normalizePeriodInput(' 2026 5 ')).toBe('2026_05');
    expect(normalizePeriodInput('202605')).toBe('2026_05');
  });

  it('rejects bad shapes and out-of-range months', () => {
    expect(normalizePeriodInput('nope')).toBeNull();
    expect(normalizePeriodInput('2026_13')).toBeNull();
    expect(normalizePeriodInput('2026_00')).toBeNull();
    expect(normalizePeriodInput('26_05')).toBeNull();
  });
});

describe('admin.service.parseTier', () => {
  it('reads ru/en tier words and emoji, else undefined', () => {
    expect(parseTier('plus')).toBe('plus');
    expect(parseTier('расширенный')).toBe('plus');
    expect(parseTier('💎')).toBe('plus');
    expect(parseTier('regular')).toBe('regular');
    expect(parseTier('обычный')).toBe('regular');
    expect(parseTier(undefined)).toBeUndefined();
    expect(parseTier('garbage')).toBeUndefined();
  });

  it('tierWord gives the bare Russian word', () => {
    expect(tierWord('plus')).toBe('расширенный');
    expect(tierWord('regular')).toBe('обычный');
  });
});

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

describe('admin.service.assertCanModerateRole', () => {
  const party = (id: number, ...roles: string[]): RoleParty => ({ id, roles });

  it('admin can grant a non-privileged role to a plain member', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'admin'), party(2, 'pending'), 'preapproved'),
    ).not.toThrow();
  });

  it('admin can ban a plain member', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'admin'), party(2, 'preapproved'), 'banned'),
    ).not.toThrow();
  });

  it('admin cannot grant admin (not strictly below own rank)', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'admin'), party(2, 'preapproved'), 'admin'),
    ).toThrow();
  });

  it('admin cannot grant super', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'admin'), party(2, 'preapproved'), 'super'),
    ).toThrow();
  });

  it('admin cannot ban a fellow admin', () => {
    expect(() => assertCanModerateRole(party(1, 'admin'), party(2, 'admin'), 'banned')).toThrow();
  });

  it('admin cannot strip roles from an adminPlus', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'admin'), party(2, 'adminPlus'), 'preapproved'),
    ).toThrow();
  });

  it('adminPlus can grant admin', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'adminPlus'), party(2, 'preapproved'), 'admin'),
    ).not.toThrow();
  });

  it('adminPlus can ban an admin', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'adminPlus'), party(2, 'admin'), 'banned'),
    ).not.toThrow();
  });

  it('adminPlus cannot grant adminPlus', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'adminPlus'), party(2, 'preapproved'), 'adminPlus'),
    ).toThrow();
  });

  it('super can grant adminPlus', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'super'), party(2, 'admin'), 'adminPlus'),
    ).not.toThrow();
  });

  it('nobody can grant super, not even super', () => {
    expect(() => assertCanModerateRole(party(1, 'super'), party(2, 'admin'), 'super')).toThrow();
  });

  it('super cannot target another super', () => {
    expect(() => assertCanModerateRole(party(1, 'super'), party(2, 'super'), 'banned')).toThrow();
  });

  it('no self-targeting, even for super', () => {
    expect(() => assertCanModerateRole(party(1, 'super'), party(1, 'super'), 'plus')).toThrow();
  });

  it('actor rank is the highest of their roles', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'preapproved', 'super'), party(2, 'admin'), 'adminPlus'),
    ).not.toThrow();
  });

  it('non-staff actor cannot moderate anything', () => {
    expect(() =>
      assertCanModerateRole(party(1, 'preapproved'), party(2, 'pending'), 'preapproved'),
    ).toThrow();
  });
});

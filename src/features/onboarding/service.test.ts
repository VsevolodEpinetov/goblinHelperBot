import { describe, expect, it } from 'vitest';

import { canSubmit, normalizeTale } from './service';

describe('onboarding.service.canSubmit', () => {
  it('true when no existing application', () => {
    expect(canSubmit(undefined)).toBe(true);
  });

  it('false when an application is already pending', () => {
    expect(canSubmit({ status: 'pending' } as never)).toBe(false);
  });

  it('false when already approved', () => {
    expect(canSubmit({ status: 'approved' } as never)).toBe(false);
  });

  it('true when previously rejected (allow re-apply)', () => {
    expect(canSubmit({ status: 'rejected' } as never)).toBe(true);
  });
});

describe('onboarding.service.normalizeTale', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTale('  я гоблин из чащи  ')).toBe('я гоблин из чащи');
  });

  it('returns null for an empty string', () => {
    expect(normalizeTale('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(normalizeTale('   \n  ')).toBeNull();
  });

  it('returns null for undefined/null', () => {
    expect(normalizeTale(undefined)).toBeNull();
    expect(normalizeTale(null)).toBeNull();
  });

  it('keeps internal newlines and content intact', () => {
    expect(normalizeTale('строка один\nстрока два')).toBe('строка один\nстрока два');
  });
});

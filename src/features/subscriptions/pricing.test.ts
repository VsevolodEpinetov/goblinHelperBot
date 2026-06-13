import { afterEach, describe, expect, it, vi } from 'vitest';

import { sbpAmountRub, sbpBasePriceRub, sbpRequisites } from './pricing';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubSbpPrices(regular: string, plus: string): void {
  vi.stubEnv('SBP_PRICE_REGULAR_RUB', regular);
  vi.stubEnv('SBP_PRICE_PLUS_RUB', plus);
}

describe('subscriptions.pricing.sbpBasePriceRub', () => {
  it('returns undefined when unset', () => {
    stubSbpPrices('', '');
    expect(sbpBasePriceRub('regular')).toBeUndefined();
    expect(sbpBasePriceRub('plus')).toBeUndefined();
  });

  it('parses integer RUB prices per tier', () => {
    stubSbpPrices('500', '1500');
    expect(sbpBasePriceRub('regular')).toBe(500);
    expect(sbpBasePriceRub('plus')).toBe(1500);
  });

  it('rejects non-integer or non-positive values', () => {
    stubSbpPrices('abc', '12.5');
    expect(sbpBasePriceRub('regular')).toBeUndefined();
    expect(sbpBasePriceRub('plus')).toBeUndefined();
    stubSbpPrices('-5', '0');
    expect(sbpBasePriceRub('regular')).toBeUndefined();
    expect(sbpBasePriceRub('plus')).toBeUndefined();
  });
});

describe('subscriptions.pricing.sbpAmountRub', () => {
  it('returns undefined when prices are not configured', () => {
    stubSbpPrices('', '');
    expect(sbpAmountRub({ tier: 'regular', kind: 'sub' })).toBeUndefined();
    expect(sbpAmountRub({ tier: 'plus', kind: 'old' })).toBeUndefined();
    expect(sbpAmountRub({ tier: 'plus', kind: 'sub', upgrade: true })).toBeUndefined();
  });

  it('charges the base price for the current month', () => {
    stubSbpPrices('500', '1500');
    expect(sbpAmountRub({ tier: 'regular', kind: 'sub' })).toBe(500);
    expect(sbpAmountRub({ tier: 'plus', kind: 'sub' })).toBe(1500);
  });

  it('charges ×3 for past months, like the Stars flow', () => {
    stubSbpPrices('500', '1500');
    expect(sbpAmountRub({ tier: 'regular', kind: 'old' })).toBe(1500);
    expect(sbpAmountRub({ tier: 'plus', kind: 'old' })).toBe(4500);
  });

  it('charges the upgrade delta for a current-month plus on top of regular', () => {
    stubSbpPrices('500', '1500');
    expect(sbpAmountRub({ tier: 'plus', kind: 'sub', upgrade: true })).toBe(1000);
  });

  it('ignores the upgrade flag for past months (full old price, like Stars)', () => {
    stubSbpPrices('500', '1500');
    expect(sbpAmountRub({ tier: 'plus', kind: 'old', upgrade: true })).toBe(4500);
  });

  it('upgrade delta needs both prices configured', () => {
    vi.stubEnv('SBP_PRICE_REGULAR_RUB', '500');
    vi.stubEnv('SBP_PRICE_PLUS_RUB', '');
    expect(sbpAmountRub({ tier: 'plus', kind: 'sub', upgrade: true })).toBeUndefined();
  });
});

describe('subscriptions.pricing.sbpRequisites', () => {
  it('returns undefined when unset or blank', () => {
    vi.stubEnv('SBP_REQUISITES', '');
    expect(sbpRequisites()).toBeUndefined();
    vi.stubEnv('SBP_REQUISITES', '   ');
    expect(sbpRequisites()).toBeUndefined();
  });

  it('returns the trimmed free-text requisites', () => {
    vi.stubEnv('SBP_REQUISITES', ' +7 900 000-00-00, Сбер ');
    expect(sbpRequisites()).toBe('+7 900 000-00-00, Сбер');
  });
});

import { describe, expect, it } from 'vitest';

import { decidePurchaseAction } from './service';

describe('subscriptions.service.decidePurchaseAction', () => {
  const today = { year: 2026, month: 5 };

  it('returns "already_plus" when user has plus for the target period', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2026, month: 5 },
        today,
        status: { period: '2026_05', hasRegular: false, hasPlus: true },
      }),
    ).toEqual({ action: 'already_plus' });
  });

  it('returns "offer_upgrade" when user has regular for current period', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2026, month: 5 },
        today,
        status: { period: '2026_05', hasRegular: true, hasPlus: false },
      }),
    ).toEqual({ action: 'offer_upgrade' });
  });

  it('returns "buy_current" when no membership and target is current period', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2026, month: 5 },
        today,
        status: { period: '2026_05', hasRegular: false, hasPlus: false },
      }),
    ).toEqual({ action: 'buy_current' });
  });

  it('returns "buy_old" when target is in the past and user has neither', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2025, month: 12 },
        today,
        status: { period: '2025_12', hasRegular: false, hasPlus: false },
      }),
    ).toEqual({ action: 'buy_old' });
  });

  it('returns "already_regular_old" when target is past and user has regular', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2025, month: 12 },
        today,
        status: { period: '2025_12', hasRegular: true, hasPlus: false },
      }),
    ).toEqual({ action: 'already_regular_old' });
  });
});

import { formatPeriod, isHistoricalPeriod, type Period } from '../../shared/period';

import type { UserSubscriptionStatus } from './repo';

export type PurchaseAction =
  | { action: 'already_plus' }
  | { action: 'already_regular_old' }
  | { action: 'offer_upgrade' }
  | { action: 'buy_current' }
  | { action: 'buy_old' };

export interface DecideInput {
  target: Period;
  today: Period;
  status: UserSubscriptionStatus;
}

/** The single state machine that decides which purchase path a user enters. */
export function decidePurchaseAction(input: DecideInput): PurchaseAction {
  if (input.status.hasPlus) return { action: 'already_plus' };
  const isPast = isHistoricalPeriod(input.target, input.today);
  if (isPast) {
    if (input.status.hasRegular) return { action: 'already_regular_old' };
    return { action: 'buy_old' };
  }
  // Current or future period
  if (input.status.hasRegular) return { action: 'offer_upgrade' };
  return { action: 'buy_current' };
}

export function periodKey(p: Period): string {
  return formatPeriod(p);
}

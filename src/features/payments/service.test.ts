import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasUserPurchased, recordPurchase } from '../kickstarters/repo';
import { grantXpInTrx } from '../loyalty';
import { getSubscriptionStatus } from '../subscriptions/repo';

import { findByChargeId, insertPending, markCompleted } from './repo';
import {
  encodePayload,
  decodePayload,
  computeOldMonthMultiplier,
  accessGroupForPayload,
  processSubscriptionPayment,
  processUpgradePayment,
  processKickstarterPayment,
  processSuccessfulPayment,
  xpForSubscriptionPayment,
} from './service';

const h = vi.hoisted(() => {
  interface Step {
    method: string;
    args: unknown[];
  }
  interface Query {
    table: string;
    steps: Step[];
  }
  const queries: Query[] = [];
  const methods = [
    'where',
    'update',
    'insert',
    'onConflict',
    'ignore',
    'increment',
    'select',
    'first',
    'returning',
  ];
  function trxFn(table: string): Record<string, unknown> {
    const q: Query = { table, steps: [] };
    queries.push(q);
    const builder: Record<string, unknown> = {};
    for (const m of methods) {
      builder[m] = (...args: unknown[]) => {
        q.steps.push({ method: m, args });
        return builder;
      };
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(onFulfilled, onRejected);
    return builder;
  }
  const trx = Object.assign(trxFn, { fn: { now: () => new Date() } });
  return {
    queries,
    trx,
    reset: () => {
      queries.length = 0;
    },
    queriesFor: (table: string) => queries.filter((q) => q.table === table),
  };
});

vi.mock('../../db/client', () => ({
  db: { transaction: (fn: (trx: unknown) => unknown) => Promise.resolve(fn(h.trx)) },
}));
vi.mock('./repo', () => ({
  findByChargeId: vi.fn(),
  insertPending: vi.fn(),
  markCompleted: vi.fn(),
}));
vi.mock('../subscriptions/repo', () => ({ getSubscriptionStatus: vi.fn() }));
vi.mock('../kickstarters/repo', () => ({ hasUserPurchased: vi.fn(), recordPurchase: vi.fn() }));
vi.mock('../loyalty', () => ({ grantXpInTrx: vi.fn(), dispatchNotifications: vi.fn() }));

const subPayload = { t: 'sub' as const, userId: 10, period: '2026_06', tier: 'regular' as const };
const upgradePayload = { t: 'upgrade' as const, userId: 10, period: '2026_06' };
const ksPayload = { t: 'ks' as const, userId: 10, kickstarterId: 42 };

const xpResult = {
  applied: true,
  gained: 600,
  totalXp: 600,
  tier: 'wood',
  level: 3,
  levelUp: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.reset();
  vi.mocked(findByChargeId).mockResolvedValue(undefined);
  vi.mocked(insertPending).mockResolvedValue(11);
  vi.mocked(getSubscriptionStatus).mockResolvedValue({
    period: '2026_06',
    hasRegular: false,
    hasPlus: false,
  });
  vi.mocked(hasUserPurchased).mockResolvedValue(false);
  vi.mocked(grantXpInTrx).mockResolvedValue(xpResult);
});

describe('payments.service.encodePayload / decodePayload', () => {
  it('round-trips a subscription payload', () => {
    const payload = { t: 'sub' as const, userId: 1, period: '2026_05', tier: 'regular' as const };
    const encoded = encodePayload(payload);
    expect(encoded.length).toBeLessThanOrEqual(128);
    expect(decodePayload(encoded)).toEqual(payload);
  });

  it('round-trips a kickstarter payload', () => {
    const payload = { t: 'ks' as const, userId: 1, kickstarterId: 42 };
    expect(decodePayload(encodePayload(payload))).toEqual(payload);
  });

  it('returns null for invalid JSON', () => {
    expect(decodePayload('not-json')).toBeNull();
  });

  it('returns null for payloads that do not match the schema', () => {
    expect(decodePayload(JSON.stringify({ t: 'unknown' }))).toBeNull();
  });
});

describe('payments.service.accessGroupForPayload', () => {
  it('maps a subscription to its period + tier', () => {
    expect(
      accessGroupForPayload({ t: 'sub', userId: 1, period: '2026_05', tier: 'regular' }),
    ).toEqual({ period: '2026_05', type: 'regular' });
  });

  it('maps an old-month purchase to its period + tier', () => {
    expect(accessGroupForPayload({ t: 'old', userId: 1, period: '2025_09', tier: 'plus' })).toEqual(
      { period: '2025_09', type: 'plus' },
    );
  });

  it('maps an upgrade to the plus group for that period', () => {
    expect(accessGroupForPayload({ t: 'upgrade', userId: 1, period: '2026_05' })).toEqual({
      period: '2026_05',
      type: 'plus',
    });
  });

  it('returns null for a kickstarter (no group access)', () => {
    expect(accessGroupForPayload({ t: 'ks', userId: 1, kickstarterId: 7 })).toBeNull();
  });
});

describe('payments.service.computeOldMonthMultiplier', () => {
  it('returns 3x for old months', () => {
    expect(computeOldMonthMultiplier()).toBe(3);
  });
});

describe('payments.service.xpForSubscriptionPayment', () => {
  it('grants the flat old-archive XP regardless of tier', () => {
    expect(xpForSubscriptionPayment('old', 'regular')).toBe(300);
    expect(xpForSubscriptionPayment('old', 'plus')).toBe(300);
  });

  it('grants tiered XP for current subscriptions', () => {
    expect(xpForSubscriptionPayment('sub', 'regular')).toBe(600);
    expect(xpForSubscriptionPayment('sub', 'plus')).toBe(1600);
  });
});

describe('payments.service.processSubscriptionPayment', () => {
  it('grants access, completes the payment and grants XP on first processing', async () => {
    const res = await processSubscriptionPayment(subPayload, 'stars', 500, 'XTR', 'charge-1');
    expect(res).toEqual({ status: 'processed', paymentId: 11 });

    const [groups] = h.queriesFor('user_groups');
    expect(groups!.steps).toEqual([
      { method: 'insert', args: [{ user_id: 10, period: '2026_06', type: 'regular' }] },
      { method: 'onConflict', args: [['user_id', 'period', 'type']] },
      { method: 'ignore', args: [] },
    ]);

    expect(markCompleted).toHaveBeenCalledWith(expect.anything(), 11, 'charge-1');

    const [months] = h.queriesFor('months');
    expect(months!.steps).toEqual([
      { method: 'where', args: [{ period: '2026_06', type: 'regular' }] },
      { method: 'increment', args: ['counter_paid', 1] },
    ]);

    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 10,
        amount: 600,
        source: 'payment_sub',
        externalId: 'charge-1',
      }),
    );
  });

  it('short-circuits to already_processed when the chargeId is already completed', async () => {
    vi.mocked(findByChargeId).mockResolvedValue({ id: 5, status: 'completed' } as never);
    const res = await processSubscriptionPayment(subPayload, 'stars', 500, 'XTR', 'charge-1');
    expect(res).toEqual({ status: 'already_processed', paymentId: 5 });
    expect(insertPending).not.toHaveBeenCalled();
    expect(grantXpInTrx).not.toHaveBeenCalled();
    expect(h.queriesFor('user_groups')).toHaveLength(0);
  });

  it('grants once and ignores the Telegram retry with the same chargeId', async () => {
    vi.mocked(findByChargeId)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 11, status: 'completed' } as never);

    const first = await processSubscriptionPayment(subPayload, 'stars', 500, 'XTR', 'charge-1');
    const second = await processSubscriptionPayment(subPayload, 'stars', 500, 'XTR', 'charge-1');

    expect(first.status).toBe('processed');
    expect(second).toEqual({ status: 'already_processed', paymentId: 11 });
    expect(insertPending).toHaveBeenCalledTimes(1);
    expect(grantXpInTrx).toHaveBeenCalledTimes(1);
    expect(h.queriesFor('user_groups')).toHaveLength(1);
  });

  it('requires a refund when the period is already owned, marking the row failed', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      period: '2026_06',
      hasRegular: true,
      hasPlus: false,
    });
    vi.mocked(insertPending).mockResolvedValue(12);

    const res = await processSubscriptionPayment(subPayload, 'stars', 500, 'XTR', 'charge-2');
    expect(res).toEqual({
      status: 'refund_required',
      paymentId: 12,
      refundUserId: 10,
      refundReason: expect.any(String),
    });

    const [tracking] = h.queriesFor('payment_tracking');
    expect(tracking!.steps).toEqual([
      { method: 'where', args: ['id', 12] },
      { method: 'update', args: [{ status: 'failed' }] },
    ]);
    expect(markCompleted).not.toHaveBeenCalled();
    expect(grantXpInTrx).not.toHaveBeenCalled();
    expect(h.queriesFor('user_groups')).toHaveLength(0);
  });

  it('still sells the plus tier when only regular is owned', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      period: '2026_06',
      hasRegular: true,
      hasPlus: false,
    });
    const res = await processSubscriptionPayment(
      { ...subPayload, tier: 'plus' },
      'stars',
      900,
      'XTR',
      'charge-3',
    );
    expect(res.status).toBe('processed');
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 1600 }),
    );
  });

  it('grants the flat old-archive XP for old-month purchases', async () => {
    await processSubscriptionPayment(
      { t: 'old', userId: 10, period: '2025_09', tier: 'regular' },
      'stars',
      1500,
      'XTR',
      'charge-4',
    );
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 300, source: 'payment_old' }),
    );
  });
});

describe('payments.service.processUpgradePayment', () => {
  it('upgrades a regular subscription to plus', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      period: '2026_06',
      hasRegular: true,
      hasPlus: false,
    });
    const res = await processUpgradePayment(upgradePayload, 'stars', 400, 'XTR', 'charge-5');
    expect(res).toEqual({ status: 'processed', paymentId: 11 });

    const [groups] = h.queriesFor('user_groups');
    expect(groups!.steps[0]).toEqual({
      method: 'insert',
      args: [{ user_id: 10, period: '2026_06', type: 'plus' }],
    });
    expect(insertPending).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'upgrade', subscriptionType: 'plus', isUpgrade: true }),
    );
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 1000, source: 'payment_upgrade', externalId: 'charge-5' }),
    );
  });

  it('requires a refund when no regular subscription exists for the period', async () => {
    vi.mocked(insertPending).mockResolvedValue(13);
    const res = await processUpgradePayment(upgradePayload, 'stars', 400, 'XTR', 'charge-6');
    expect(res).toEqual({
      status: 'refund_required',
      paymentId: 13,
      refundUserId: 10,
      refundReason: expect.any(String),
    });
    const [tracking] = h.queriesFor('payment_tracking');
    expect(tracking!.steps).toEqual([
      { method: 'where', args: ['id', 13] },
      { method: 'update', args: [{ status: 'failed' }] },
    ]);
    expect(markCompleted).not.toHaveBeenCalled();
    expect(grantXpInTrx).not.toHaveBeenCalled();
  });

  it('requires a refund when plus is already owned (stale upgrade invoice)', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      period: '2026_06',
      hasRegular: true,
      hasPlus: true,
    });
    const res = await processUpgradePayment(upgradePayload, 'stars', 400, 'XTR', 'charge-7');
    expect(res.status).toBe('refund_required');
    expect(res.refundUserId).toBe(10);
    expect(h.queriesFor('user_groups')).toHaveLength(0);
  });

  it('short-circuits to already_processed on a duplicate chargeId', async () => {
    vi.mocked(findByChargeId).mockResolvedValue({ id: 8, status: 'completed' } as never);
    const res = await processUpgradePayment(upgradePayload, 'stars', 400, 'XTR', 'charge-8');
    expect(res).toEqual({ status: 'already_processed', paymentId: 8 });
    expect(insertPending).not.toHaveBeenCalled();
  });
});

describe('payments.service.processKickstarterPayment', () => {
  it('records the purchase and grants XP on first processing', async () => {
    const res = await processKickstarterPayment(ksPayload, 250, 'XTR', 'charge-9');
    expect(res).toEqual({ status: 'processed', paymentId: 11 });
    expect(recordPurchase).toHaveBeenCalledWith(expect.anything(), 10, 42);
    expect(markCompleted).toHaveBeenCalledWith(expect.anything(), 11, 'charge-9');
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 300, source: 'payment_ks', externalId: 'charge-9' }),
    );
  });

  it('requires a refund when the kickstarter is already owned', async () => {
    vi.mocked(hasUserPurchased).mockResolvedValue(true);
    vi.mocked(insertPending).mockResolvedValue(14);
    const res = await processKickstarterPayment(ksPayload, 250, 'XTR', 'charge-10');
    expect(res).toEqual({
      status: 'refund_required',
      paymentId: 14,
      refundUserId: 10,
      refundReason: expect.any(String),
    });
    const [tracking] = h.queriesFor('payment_tracking');
    expect(tracking!.steps).toEqual([
      { method: 'where', args: ['id', 14] },
      { method: 'update', args: [{ status: 'failed' }] },
    ]);
    expect(recordPurchase).not.toHaveBeenCalled();
    expect(grantXpInTrx).not.toHaveBeenCalled();
  });

  it('short-circuits to already_processed on a duplicate chargeId', async () => {
    vi.mocked(findByChargeId).mockResolvedValue({ id: 9, status: 'completed' } as never);
    const res = await processKickstarterPayment(ksPayload, 250, 'XTR', 'charge-11');
    expect(res).toEqual({ status: 'already_processed', paymentId: 9 });
    expect(recordPurchase).not.toHaveBeenCalled();
  });
});

describe('payments.service.processSuccessfulPayment', () => {
  it('returns unknown_payload for garbage without touching the DB', async () => {
    const res = await processSuccessfulPayment('garbage', 100, 'XTR', 'charge-12');
    expect(res).toEqual({ status: 'unknown_payload' });
    expect(insertPending).not.toHaveBeenCalled();
    expect(h.queries).toHaveLength(0);
  });

  it('dispatches subscription payloads to the subscription processor', async () => {
    const res = await processSuccessfulPayment(encodePayload(subPayload), 500, 'XTR', 'charge-13');
    expect(res.status).toBe('processed');
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'payment_sub' }),
    );
  });
});

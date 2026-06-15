import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchNotifications, grantXpInTrx } from '../loyalty';

import { registerPaymentAdminActions } from './admin-actions';
import { deliverAccessKeys } from './invite-delivery';

const h = vi.hoisted(() => {
  interface Step {
    method: string;
    args: unknown[];
  }
  interface Query {
    table: string;
    steps: Step[];
  }
  const state = {
    queries: [] as Query[],
    resolve: (() => undefined) as (q: Query) => unknown,
  };
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
    'leftJoin',
    'orderBy',
    'limit',
  ];
  function connFn(table: string): Record<string, unknown> {
    const q: Query = { table, steps: [] };
    state.queries.push(q);
    const builder: Record<string, unknown> = {};
    for (const m of methods) {
      builder[m] = (...args: unknown[]) => {
        q.steps.push({ method: m, args });
        return builder;
      };
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => state.resolve(q))
        .then(onFulfilled, onRejected);
    return builder;
  }
  const conn = Object.assign(connFn, {
    fn: { now: () => new Date() },
    transaction: (fn: (trx: unknown) => unknown): Promise<unknown> => Promise.resolve(fn(conn)),
  });
  return {
    state,
    conn,
    reset: () => {
      state.queries.length = 0;
      state.resolve = () => undefined;
    },
    queriesFor: (table: string) => state.queries.filter((q) => q.table === table),
    has: (q: Query, method: string) => q.steps.some((s) => s.method === method),
  };
});

vi.mock('../../db/client', () => ({ db: h.conn }));
vi.mock('../loyalty', () => ({ grantXpInTrx: vi.fn(), dispatchNotifications: vi.fn() }));
vi.mock('./invite-delivery', () => ({ deliverAccessKeys: vi.fn() }));

type Handler = (ctx: never) => Promise<void>;
const actions = new Map<string, Handler>();
registerPaymentAdminActions({
  action: (trigger: RegExp | string, ...fns: unknown[]) => {
    actions.set(String(trigger), fns[fns.length - 1] as Handler);
  },
} as never);

const confirm = actions.get(String(/^sbp:confirm:(\d+)$/))!;
const reject = actions.get(String(/^sbp:reject:(\d+)$/))!;

function makeCtx(data: string) {
  const id = /:(\d+)$/.exec(data)![1]!;
  return {
    match: [data, id] as unknown as RegExpExecArray,
    from: { id: 900, username: 'admin' },
    callbackQuery: { message: { caption: 'SBP card' } },
    answerCbQuery: vi.fn().mockResolvedValue(true),
    editMessageCaption: vi.fn().mockResolvedValue(true),
    telegram: { sendMessage: vi.fn().mockResolvedValue(true) },
  };
}

const claimedRow = {
  user_id: 7,
  period: '2026_06',
  subscription_type: 'regular' as const,
  type: 'sub',
};

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
  vi.mocked(grantXpInTrx).mockResolvedValue(xpResult);
});

describe('payments.admin-actions sbp:confirm', () => {
  it('claims only a pending row, grants access + XP and delivers keys', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning')) return [claimedRow];
      if (q.table === 'user_groups' && h.has(q, 'select')) return [];
      return undefined;
    };
    const ctx = makeCtx('sbp:confirm:5');
    await confirm(ctx as never);

    const [claim] = h.queriesFor('payment_tracking');
    expect(claim!.steps[0]).toEqual({ method: 'where', args: [{ id: 5, status: 'pending' }] });
    expect(claim!.steps[1]!.method).toBe('update');
    expect(claim!.steps[1]!.args[0]).toMatchObject({
      status: 'completed',
      telegram_payment_charge_id: 'sbp:5',
    });

    const inserts = h.queriesFor('user_groups').filter((q) => h.has(q, 'insert'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.steps[0]).toEqual({
      method: 'insert',
      args: [[{ user_id: 7, period: '2026_06', type: 'regular' }]],
    });

    const [months] = h.queriesFor('months');
    expect(months!.steps).toEqual([
      { method: 'where', args: [{ period: '2026_06', type: 'regular' }] },
      { method: 'increment', args: ['counter_paid', 1] },
    ]);

    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 7, amount: 600, externalId: 'sbp:5' }),
    );
    expect(dispatchNotifications).toHaveBeenCalledWith(7, xpResult, 'payment_sub_sbp');
    expect(deliverAccessKeys).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, period: '2026_06', types: ['regular'] }),
    );
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageCaption).toHaveBeenCalledTimes(1);
  });

  it('grants the flat old-archive XP for an old-month SBP payment', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning'))
        return [{ ...claimedRow, type: 'old' }];
      if (q.table === 'user_groups' && h.has(q, 'select')) return [];
      return undefined;
    };
    await confirm(makeCtx('sbp:confirm:5') as never);
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 300 }),
    );
  });

  it('does nothing when the row was already decided (second admin tap)', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning')) return [];
      if (q.table === 'payment_tracking' && h.has(q, 'first')) return { status: 'completed' };
      return undefined;
    };
    const ctx = makeCtx('sbp:confirm:5');
    await confirm(ctx as never);
    expect(grantXpInTrx).not.toHaveBeenCalled();
    expect(deliverAccessKeys).not.toHaveBeenCalled();
    expect(h.queriesFor('user_groups')).toHaveLength(0);
    expect(ctx.editMessageCaption).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the payment row does not exist', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning')) return [];
      return undefined;
    };
    const ctx = makeCtx('sbp:confirm:5');
    await confirm(ctx as never);
    expect(grantXpInTrx).not.toHaveBeenCalled();
    expect(deliverAccessKeys).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
  });

  it('fails the row instead of double-granting when the period was meanwhile bought with Stars', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning')) return [claimedRow];
      if (q.table === 'user_groups' && h.has(q, 'select')) return [{ type: 'regular' }];
      return undefined;
    };
    const ctx = makeCtx('sbp:confirm:5');
    await confirm(ctx as never);

    const updates = h.queriesFor('payment_tracking');
    expect(updates[1]!.steps).toEqual([
      { method: 'where', args: ['id', 5] },
      { method: 'update', args: [{ status: 'failed' }] },
    ]);
    expect(grantXpInTrx).not.toHaveBeenCalled();
    expect(deliverAccessKeys).not.toHaveBeenCalled();
    expect(ctx.editMessageCaption).toHaveBeenCalledTimes(1);
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(
      7,
      expect.stringContaining('2026_06'),
      expect.anything(),
    );
  });

  it('grants BOTH groups and delivers both keys on a plus SBP payment', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning'))
        return [{ ...claimedRow, subscription_type: 'plus' }];
      // No prior groups owned — a fresh plus transfer.
      if (q.table === 'user_groups' && h.has(q, 'select')) return [];
      return undefined;
    };
    await confirm(makeCtx('sbp:confirm:5') as never);
    expect(grantXpInTrx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 1600 }),
    );

    const inserts = h.queriesFor('user_groups').filter((q) => h.has(q, 'insert'));
    expect(inserts[0]!.steps[0]).toEqual({
      method: 'insert',
      args: [
        [
          { user_id: 7, period: '2026_06', type: 'regular' },
          { user_id: 7, period: '2026_06', type: 'plus' },
        ],
      ],
    });

    expect(deliverAccessKeys).toHaveBeenCalledWith(
      expect.objectContaining({ types: ['regular', 'plus'] }),
    );
  });
});

describe('payments.admin-actions sbp:reject', () => {
  it('rejects only a pending row and notifies the member', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning'))
        return [{ user_id: 7, period: '2026_06' }];
      return undefined;
    };
    const ctx = makeCtx('sbp:reject:5');
    await reject(ctx as never);

    const [claim] = h.queriesFor('payment_tracking');
    expect(claim!.steps).toEqual([
      { method: 'where', args: [{ id: 5, status: 'pending' }] },
      { method: 'update', args: [{ status: 'failed' }] },
      { method: 'returning', args: [['user_id', 'period']] },
    ]);
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(
      7,
      expect.stringContaining('2026_06'),
      expect.anything(),
    );
    expect(ctx.editMessageCaption).toHaveBeenCalledTimes(1);
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
  });

  it('cannot flip an already-completed payment to failed', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning')) return [];
      if (q.table === 'payment_tracking' && h.has(q, 'first')) return { status: 'completed' };
      return undefined;
    };
    const ctx = makeCtx('sbp:reject:5');
    await reject(ctx as never);
    expect(ctx.telegram.sendMessage).not.toHaveBeenCalled();
    expect(ctx.editMessageCaption).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
  });

  it('answers without notifying anyone when the row does not exist', async () => {
    h.state.resolve = (q) => {
      if (q.table === 'payment_tracking' && h.has(q, 'returning')) return [];
      return undefined;
    };
    const ctx = makeCtx('sbp:reject:5');
    await reject(ctx as never);
    expect(ctx.telegram.sendMessage).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
  });
});

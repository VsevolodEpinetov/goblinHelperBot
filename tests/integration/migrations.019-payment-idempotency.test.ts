import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTestDb } from './setup';

const M_019 = '019_add_payment_idempotency.ts';

describe('migration 019 — payment idempotency', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('adds source column to payment_tracking defaulting to stars', async () => {
    await db.migrate.latest();
    expect(await db.schema.hasColumn('payment_tracking', 'source')).toBe(true);
  });

  it('blocks duplicate telegram_payment_charge_id inserts', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('payment_tracking').insert({
      user_id: 1,
      type: 'subscription',
      subscription_type: 'regular',
      period: '2026_05',
      amount: 100,
      currency: 'XTR',
      status: 'completed',
      telegram_payment_charge_id: 'charge_123',
      source: 'stars',
    });

    await expect(
      db('payment_tracking').insert({
        user_id: 1,
        type: 'subscription',
        subscription_type: 'regular',
        period: '2026_06',
        amount: 100,
        currency: 'XTR',
        status: 'completed',
        telegram_payment_charge_id: 'charge_123',
        source: 'stars',
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('allows nullable telegram_payment_charge_id (no UNIQUE violation on NULLs)', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('payment_tracking').insert({
      user_id: 1,
      type: 'manual',
      period: '2026_05',
      amount: 100,
      currency: 'RUB',
      status: 'pending',
      source: 'sbp',
      // telegram_payment_charge_id omitted (NULL)
    });
    await expect(
      db('payment_tracking').insert({
        user_id: 1,
        type: 'manual',
        period: '2026_06',
        amount: 100,
        currency: 'RUB',
        status: 'pending',
        source: 'sbp',
      }),
    ).resolves.toBeDefined();
  });

  it('blocks duplicate xp_transactions on (source, external_id)', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('xp_transactions').insert({
      user_id: 1,
      amount: 100,
      source: 'payment',
      external_id: 'charge_abc',
    });

    await expect(
      db('xp_transactions').insert({
        user_id: 1,
        amount: 100,
        source: 'payment',
        external_id: 'charge_abc',
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('allows two xp_transactions with same source but different external_ids', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('xp_transactions').insert([
      { user_id: 1, amount: 100, source: 'payment', external_id: 'charge_a' },
      { user_id: 1, amount: 50, source: 'payment', external_id: 'charge_b' },
    ]);
    const rows = await db('xp_transactions').where('source', 'payment');
    expect(rows.length).toBe(2);
  });

  it('down-migration drops source column and unique indices', async () => {
    await db.migrate.latest();
    await db.migrate.down({ name: M_019 });

    expect(await db.schema.hasColumn('payment_tracking', 'source')).toBe(false);
    expect(await db.schema.hasColumn('xp_transactions', 'external_id')).toBe(false);
  });
});

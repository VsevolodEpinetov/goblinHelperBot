import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  findByChargeId,
  insertPending,
  listForUser,
  markCompleted,
  markFailed,
} from '../../src/features/payments/repo';

import { setupTestDb } from './setup';

describe('payments.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('insertPending + markCompleted + findByChargeId round-trips', async () => {
    const id = await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'plus',
      period: '2026_05',
      amount: 500,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    await markCompleted(db, id, 'charge_xyz');
    const row = await findByChargeId(db, 'charge_xyz');
    expect(row).toBeDefined();
    expect(row!.status).toBe('completed');
    expect(row!.subscriptionType).toBe('plus');
  });

  it('telegram_payment_charge_id UNIQUE constraint fires', async () => {
    const id1 = await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'regular',
      period: '2026_05',
      amount: 100,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    await markCompleted(db, id1, 'dupe');

    const id2 = await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'regular',
      period: '2026_06',
      amount: 100,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    await expect(markCompleted(db, id2, 'dupe')).rejects.toThrow(/unique|duplicate/i);
  });

  it('listForUser returns descending by created_at', async () => {
    await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'regular',
      period: '2026_05',
      amount: 1,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'plus',
      period: '2026_06',
      amount: 2,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    const rows = await listForUser(db, 1);
    expect(rows[0]!.period).toBe('2026_06');
  });

  it('markFailed updates status', async () => {
    const id = await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'regular',
      period: '2026_05',
      amount: 1,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'sbp',
    });
    await markFailed(db, id);
    const rows = await listForUser(db, 1);
    expect(rows[0]!.status).toBe('failed');
  });
});

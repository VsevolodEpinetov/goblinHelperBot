import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getLeaderboard,
  getUserLevel,
  insertXpTransaction,
  upsertUserLevel,
} from '../../src/features/loyalty/repo';

import { setupTestDb } from './setup';

describe('loyalty.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('upsertUserLevel + getUserLevel round-trips', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    await upsertUserLevel(db, {
      userId: 1,
      currentTier: 'bronze',
      currentLevel: 3,
      totalXp: 2500,
      xpToNextLevel: 100,
    });
    const row = await getUserLevel(db, 1);
    expect(row).toBeDefined();
    expect(row!.currentTier).toBe('bronze');
    expect(row!.totalXp).toBe(2500);
  });

  it('insertXpTransaction enforces UNIQUE(source, external_id)', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    expect(
      await insertXpTransaction(db, {
        userId: 1,
        amount: 50,
        source: 'payment',
        externalId: 'ch_a',
      }),
    ).toBe(true);
    expect(
      await insertXpTransaction(db, {
        userId: 1,
        amount: 50,
        source: 'payment',
        externalId: 'ch_a',
      }),
    ).toBe(false);
    // Different source — allowed
    expect(
      await insertXpTransaction(db, { userId: 1, amount: 50, source: 'raid', externalId: 'ch_a' }),
    ).toBe(true);
  });

  it('insertXpTransaction allows multiple NULL external_ids', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    expect(await insertXpTransaction(db, { userId: 1, amount: 1, source: 'message' })).toBe(true);
    expect(await insertXpTransaction(db, { userId: 1, amount: 1, source: 'message' })).toBe(true);
  });

  it('getLeaderboard orders by total_xp desc and joins users', async () => {
    await db('users').insert([
      { id: 1, username: 'u1' },
      { id: 2, username: 'u2' },
    ]);
    await upsertUserLevel(db, { userId: 1, currentTier: 'wood', currentLevel: 1, totalXp: 100 });
    await upsertUserLevel(db, { userId: 2, currentTier: 'bronze', currentLevel: 1, totalXp: 3000 });

    const rows = await getLeaderboard(db, 10);
    expect(rows[0]!.userId).toBe(2);
    expect(rows[1]!.userId).toBe(1);
    expect(rows[0]!.username).toBe('u2');
  });
});

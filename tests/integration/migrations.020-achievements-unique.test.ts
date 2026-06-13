import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTestDb } from './setup';

describe('migration 020 — user_achievements UNIQUE', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('deduplicates existing duplicate rows on (user_id, achievement_type)', async () => {
    await db.migrate.up({ name: '019_add_payment_idempotency.ts' });

    await db('users').insert({ id: 1, username: 'u1' });
    await db('user_achievements').insert([
      { user_id: 1, achievement_type: 'years_of_service' },
      { user_id: 1, achievement_type: 'years_of_service' },
      { user_id: 1, achievement_type: 'years_of_service' },
    ]);

    await db.migrate.up({ name: '020_add_user_achievements_unique.ts' });

    const rows = await db('user_achievements').where({
      user_id: 1,
      achievement_type: 'years_of_service',
    });
    expect(rows).toHaveLength(1);
  });

  it('rejects duplicate inserts after migration', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('user_achievements').insert({ user_id: 1, achievement_type: 'sbp_payment' });

    await expect(
      db('user_achievements').insert({ user_id: 1, achievement_type: 'sbp_payment' }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('down-migration drops the constraint and allows duplicates again', async () => {
    await db.migrate.latest();
    await db.migrate.down({ name: '020_add_user_achievements_unique.ts' });

    await db('users').insert({ id: 1, username: 'u1' });
    await db('user_achievements').insert([
      { user_id: 1, achievement_type: 'years_of_service' },
      { user_id: 1, achievement_type: 'years_of_service' },
    ]);
    const rows = await db('user_achievements').where({ user_id: 1 });
    expect(rows).toHaveLength(2);
  });
});

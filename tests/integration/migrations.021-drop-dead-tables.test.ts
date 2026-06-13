import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTestDb } from './setup';

describe('migration 021 — drop dead tables', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('drops userLoyalty and the 8 lots tables', async () => {
    await db.migrate.latest();
    const dropped = [
      'userLoyalty',
      'lots',
      'lot_categories',
      'lot_tags',
      'lot_photos',
      'lot_participants',
      'lot_tag_assignments',
      'user_preferences',
      'user_favorites',
    ];
    for (const table of dropped) {
      expect(await db.schema.hasTable(table)).toBe(false);
    }
  });

  it('down-migration recreates the tables as empty', async () => {
    await db.migrate.latest();
    await db.migrate.down({ name: '021_drop_dead_tables.ts' });

    expect(await db.schema.hasTable('userLoyalty')).toBe(true);
    expect(await db.schema.hasTable('lots')).toBe(true);
    expect(await db.schema.hasTable('lot_categories')).toBe(true);

    // Tables are empty after re-creation
    const count = await db('userLoyalty').count('*').first();
    expect(Number(count?.count ?? 0)).toBe(0);
  });
});

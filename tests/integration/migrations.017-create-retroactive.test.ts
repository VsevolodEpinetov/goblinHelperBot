import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTestDb } from './setup';

describe('migration 017 — retroactive tables', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('creates users, months, kickstarters, applications, and settings on a fresh DB', async () => {
    await db.migrate.latest();

    for (const table of ['users', 'months', 'kickstarters', 'applications', 'settings']) {
      const has = await db.schema.hasTable(table);
      expect(has).toBe(true);
    }
  });

  it('is idempotent — re-running migrate:latest does not throw', async () => {
    await db.migrate.latest();
    await db.migrate.latest();
    // No assertion beyond "no error" — the hasTable guards make up() a no-op.
  });
});

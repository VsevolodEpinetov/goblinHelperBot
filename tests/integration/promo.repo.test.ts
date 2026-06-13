import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addPromoFile,
  getActiveCooldown,
  pickPromoFileForUser,
  recordPromoUsage,
} from '../../src/features/promo/repo';
import { computeCooldownUntil } from '../../src/features/promo/service';

import { setupTestDb } from './setup';

describe('promo.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('pickPromoFileForUser returns one of the active files, then undefined when all on cooldown', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    await addPromoFile(db, 'fid1', 'photo', 'a.jpg', 100, 999);
    await addPromoFile(db, 'fid2', 'photo', 'b.jpg', 100, 999);

    const first = await pickPromoFileForUser(db, 1);
    expect(first).toBeDefined();
    await recordPromoUsage(db, 1, first!.id, computeCooldownUntil());

    const second = await pickPromoFileForUser(db, 1);
    expect(second).toBeDefined();
    expect(second!.id).not.toBe(first!.id);
    await recordPromoUsage(db, 1, second!.id, computeCooldownUntil());

    const exhausted = await pickPromoFileForUser(db, 1);
    expect(exhausted).toBeUndefined();
  });

  it('getActiveCooldown returns the latest active cooldown', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    const id = await addPromoFile(db, 'fid', 'photo', null, null, 999);
    await recordPromoUsage(db, 1, id, computeCooldownUntil());

    const cd = await getActiveCooldown(db, 1);
    expect(cd).toBeDefined();
    expect(cd!.getTime()).toBeGreaterThan(Date.now());
  });

  it('getActiveCooldown returns undefined when no cooldown is active', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    expect(await getActiveCooldown(db, 1)).toBeUndefined();
  });
});

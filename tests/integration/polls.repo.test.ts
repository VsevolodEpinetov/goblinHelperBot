import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addCoreStudio,
  addDynamicStudio,
  listCoreStudios,
  listDynamicStudios,
  resetCoreStudios,
  resetDynamicStudios,
} from '../../src/features/polls/repo';

import { setupTestDb } from './setup';

describe('polls.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('addCoreStudio returns "added" then "duplicate"', async () => {
    expect(await addCoreStudio(db, 'Studio A')).toBe('added');
    expect(await addCoreStudio(db, 'Studio A')).toBe('duplicate');
  });

  it('addDynamicStudio behaves the same', async () => {
    expect(await addDynamicStudio(db, 'Dyn A')).toBe('added');
    expect(await addDynamicStudio(db, 'Dyn A')).toBe('duplicate');
  });

  it('lists are ordered as expected', async () => {
    await addCoreStudio(db, 'B');
    await addCoreStudio(db, 'A');
    const core = await listCoreStudios(db);
    expect(core.map((r) => r.name)).toEqual(['A', 'B']);

    await addDynamicStudio(db, 'X');
    await addDynamicStudio(db, 'Y');
    const dyn = await listDynamicStudios(db);
    expect(dyn.map((r) => r.name)).toEqual(['X', 'Y']);
  });

  it('reset deletes all rows', async () => {
    await addCoreStudio(db, 'A');
    await addDynamicStudio(db, 'B');
    expect(await resetCoreStudios(db)).toBeGreaterThanOrEqual(1);
    expect(await resetDynamicStudios(db)).toBeGreaterThanOrEqual(1);
    expect(await listCoreStudios(db)).toEqual([]);
    expect(await listDynamicStudios(db)).toEqual([]);
  });
});

import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getScrollBalance, getUserScrolls } from '../../src/features/scrolls/repo';
import {
  InsufficientScrollsError,
  giveScroll,
  useScroll,
} from '../../src/features/scrolls/service';

import { setupTestDb } from './setup';

describe('scrolls (service + repo)', () => {
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

  it('giveScroll increases the balance atomically', async () => {
    const after = await giveScroll({ userId: 1, scrollId: 'common', amount: 3 });
    expect(after).toBe(3);
    expect(await getScrollBalance(db, 1, 'common')).toBe(3);
  });

  it('useScroll deducts and throws when insufficient', async () => {
    await giveScroll({ userId: 1, scrollId: 'epic', amount: 2 });
    const after = await useScroll({ userId: 1, scrollId: 'epic' });
    expect(after).toBe(1);

    await useScroll({ userId: 1, scrollId: 'epic' });
    await expect(useScroll({ userId: 1, scrollId: 'epic' })).rejects.toBeInstanceOf(
      InsufficientScrollsError,
    );
  });

  it('getUserScrolls only returns scrolls with amount > 0', async () => {
    await giveScroll({ userId: 1, scrollId: 'a', amount: 5 });
    await giveScroll({ userId: 1, scrollId: 'b', amount: 1 });
    await useScroll({ userId: 1, scrollId: 'b' }); // 1 → 0
    const scrolls = await getUserScrolls(db, 1);
    expect(scrolls.map((s) => s.scrollId)).toEqual(['a']);
  });

  it('audit log records both add and remove operations', async () => {
    await giveScroll({ userId: 1, scrollId: 'rare', amount: 2, reason: 'milestone' });
    await useScroll({ userId: 1, scrollId: 'rare', reason: 'purchase' });
    const logs = await db('scroll_logs')
      .where({ user_id: 1, scroll_id: 'rare' })
      .orderBy('id', 'asc');
    expect(logs).toHaveLength(2);
    expect(logs[0]!.action).toBe('add');
    expect(logs[0]!.reason).toBe('milestone');
    expect(logs[1]!.action).toBe('remove');
  });
});

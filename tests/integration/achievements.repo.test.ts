import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  grantAchievement,
  getUserAchievements,
  userHasAchievement,
} from '../../src/features/achievements/service';

import { setupTestDb } from './setup';

describe('achievements', () => {
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

  it('grantAchievement is idempotent', async () => {
    const first = await grantAchievement({ userId: 1, type: 'sbp_payment' });
    expect(first.applied).toBe(true);

    const second = await grantAchievement({ userId: 1, type: 'sbp_payment' });
    expect(second.applied).toBe(false);
    expect(second.alreadyHad).toBe(true);
  });

  it('userHasAchievement returns true after grant', async () => {
    expect(await userHasAchievement(1, 'years_of_service')).toBe(false);
    await grantAchievement({ userId: 1, type: 'years_of_service' });
    expect(await userHasAchievement(1, 'years_of_service')).toBe(true);
  });

  it('getUserAchievements returns enriched display data', async () => {
    await grantAchievement({ userId: 1, type: 'sbp_payment' });
    const list = await getUserAchievements(1);
    expect(list).toHaveLength(1);
    expect(list[0]!.displayName).toBeTruthy();
    expect(list[0]!.description).toBeTruthy();
  });
});

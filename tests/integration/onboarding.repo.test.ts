import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  countApplications,
  getApplicationById,
  getApplicationByUserId,
  insertApplication,
  listApplications,
  setApplicationStatus,
} from '../../src/features/onboarding/repo';

import { setupTestDb } from './setup';

describe('onboarding.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1', first_name: 'Alice' });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('insertApplication + getApplicationByUserId round-trips', async () => {
    const id = await insertApplication(db, {
      userId: 1,
      username: 'u1',
      firstName: 'Alice',
      lastName: null,
    });
    const app = await getApplicationByUserId(db, 1);
    expect(app?.id).toBe(id);
    expect(app?.status).toBe('pending');
  });

  it('setApplicationStatus updates and updated_at', async () => {
    const id = await insertApplication(db, {
      userId: 1,
      username: 'u1',
      firstName: 'A',
      lastName: null,
    });
    await setApplicationStatus(db, id, 'approved');
    const app = await getApplicationById(db, id);
    expect(app?.status).toBe('approved');
  });

  it('listApplications + countApplications filter by status', async () => {
    await insertApplication(db, { userId: 1, username: 'u1', firstName: 'A', lastName: null });
    expect(await countApplications(db, { status: 'pending' })).toBe(1);
    expect(await countApplications(db, { status: 'approved' })).toBe(0);

    const list = await listApplications(db, { status: 'pending' });
    expect(list).toHaveLength(1);
  });
});

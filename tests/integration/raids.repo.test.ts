import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createRaid,
  getRaidById,
  getRaidPhotos,
  joinRaid,
  leaveRaid,
  listRaids,
  listRaidsByCreator,
  listRaidsForParticipant,
  updateRaidStatus,
} from '../../src/features/raids/repo';

import { setupTestDb } from './setup';

describe('raids.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert([
      { id: 1, username: 'alice' },
      { id: 2, username: 'bob' },
    ]);
  });

  afterEach(async () => {
    await cleanup();
  });

  it('createRaid + getRaidById round-trips', async () => {
    const id = await createRaid(db, {
      title: 'Test',
      description: 'd',
      link: null,
      price: 100,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: ['file1', 'file2'],
    });
    const raid = await getRaidById(db, id);
    expect(raid).toBeDefined();
    expect(raid!.title).toBe('Test');
    const photos = await getRaidPhotos(db, id);
    expect(photos.map((p) => p.fileId)).toEqual(['file1', 'file2']);
  });

  it('joinRaid is race-safe via PRIMARY KEY', async () => {
    const id = await createRaid(db, {
      title: 'r',
      description: null,
      link: null,
      price: 0,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: [],
    });
    expect(
      await joinRaid(db, id, { userId: 2, username: 'bob', firstName: 'Bob', lastName: null }),
    ).toBe('joined');
    expect(
      await joinRaid(db, id, { userId: 2, username: 'bob', firstName: 'Bob', lastName: null }),
    ).toBe('already_joined');
  });

  it('leaveRaid returns "left" or "was_not_in"', async () => {
    const id = await createRaid(db, {
      title: 'r',
      description: null,
      link: null,
      price: 0,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: [],
    });
    expect(await leaveRaid(db, id, 2)).toBe('was_not_in');
    await joinRaid(db, id, { userId: 2, username: 'bob', firstName: 'Bob', lastName: null });
    expect(await leaveRaid(db, id, 2)).toBe('left');
  });

  it('listRaidsByCreator and listRaidsForParticipant return correctly', async () => {
    const id = await createRaid(db, {
      title: 'r',
      description: null,
      link: null,
      price: 0,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: [],
    });
    await joinRaid(db, id, { userId: 2, username: 'bob', firstName: 'Bob', lastName: null });

    const byCreator = await listRaidsByCreator(db, 1);
    expect(byCreator.map((r) => r.id)).toContain(id);
    const byParticipant = await listRaidsForParticipant(db, 2);
    expect(byParticipant.map((r) => r.id)).toContain(id);
  });

  it('updateRaidStatus persists', async () => {
    const id = await createRaid(db, {
      title: 'r',
      description: null,
      link: null,
      price: 0,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: [],
    });
    await updateRaidStatus(db, id, 'completed');
    expect((await getRaidById(db, id))!.status).toBe('completed');
  });

  it('listRaids filters by status', async () => {
    const id1 = await createRaid(db, {
      title: 'open',
      description: null,
      link: null,
      price: 0,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: [],
    });
    const id2 = await createRaid(db, {
      title: 'closed',
      description: null,
      link: null,
      price: 0,
      currency: 'RUB',
      endDate: null,
      createdBy: 1,
      createdByUsername: 'alice',
      createdByFirstName: 'Alice',
      createdByLastName: null,
      photoFileIds: [],
    });
    await updateRaidStatus(db, id2, 'closed');

    const open = await listRaids(db, { status: 'open' });
    expect(open.map((r) => r.id)).toContain(id1);
    expect(open.map((r) => r.id)).not.toContain(id2);
  });
});

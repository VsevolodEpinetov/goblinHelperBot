import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createKickstarter,
  getKickstarterById,
  getKickstarterFiles,
  getKickstarterPhotos,
  hasUserPurchased,
  listKickstarters,
  listUserKickstarters,
  recordPurchase,
  updateKickstarterField,
} from '../../src/features/kickstarters/repo';

import { setupTestDb } from './setup';

describe('kickstarters.repo', () => {
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

  it('createKickstarter round-trips with photos and files', async () => {
    const id = await createKickstarter(db, {
      name: 'Mech',
      creator: 'Acme',
      cost: 1500,
      pledgeName: 'Standard',
      pledgeCost: 800,
      link: 'https://example.com',
      photoFileIds: ['ph1', 'ph2'],
      fileFileIds: ['f1'],
    });
    const ks = await getKickstarterById(db, id);
    expect(ks?.name).toBe('Mech');
    const photos = await getKickstarterPhotos(db, id);
    expect(photos.map((p) => p.fileId)).toEqual(['ph1', 'ph2']);
    const files = await getKickstarterFiles(db, id);
    expect(files.map((f) => f.fileId)).toEqual(['f1']);
  });

  it('hasUserPurchased + recordPurchase', async () => {
    const id = await createKickstarter(db, {
      name: 'X',
      creator: null,
      cost: 100,
      pledgeName: null,
      pledgeCost: null,
      link: null,
      photoFileIds: [],
      fileFileIds: [],
    });
    expect(await hasUserPurchased(db, 1, id)).toBe(false);
    expect(await recordPurchase(db, 1, id)).toBe(true);
    expect(await hasUserPurchased(db, 1, id)).toBe(true);
    expect(await recordPurchase(db, 1, id)).toBe(false); // idempotent
  });

  it('updateKickstarterField updates whitelisted fields', async () => {
    const id = await createKickstarter(db, {
      name: 'Old',
      creator: null,
      cost: 100,
      pledgeName: null,
      pledgeCost: null,
      link: null,
      photoFileIds: [],
      fileFileIds: [],
    });
    await updateKickstarterField(db, id, 'name', 'New Name');
    expect((await getKickstarterById(db, id))!.name).toBe('New Name');
    await updateKickstarterField(db, id, 'cost', 2000);
    expect((await getKickstarterById(db, id))!.cost).toBe(2000);
  });

  it('updateKickstarterField rejects non-whitelisted columns', async () => {
    const id = await createKickstarter(db, {
      name: 'X',
      creator: null,
      cost: 100,
      pledgeName: null,
      pledgeCost: null,
      link: null,
      photoFileIds: [],
      fileFileIds: [],
    });
    await expect(
      updateKickstarterField(db, id, 'created_at' as never, 'whatever'),
    ).rejects.toThrow();
  });

  it('listUserKickstarters joins correctly', async () => {
    const id = await createKickstarter(db, {
      name: 'Y',
      creator: null,
      cost: 100,
      pledgeName: null,
      pledgeCost: null,
      link: null,
      photoFileIds: [],
      fileFileIds: [],
    });
    await recordPurchase(db, 1, id);
    const list = await listUserKickstarters(db, 1);
    expect(list.map((k) => k.id)).toContain(id);
    expect(await listUserKickstarters(db, 2)).toHaveLength(0);
  });

  it('listKickstarters orders by created_at desc', async () => {
    const id1 = await createKickstarter(db, {
      name: 'A',
      creator: null,
      cost: 100,
      pledgeName: null,
      pledgeCost: null,
      link: null,
      photoFileIds: [],
      fileFileIds: [],
    });
    const id2 = await createKickstarter(db, {
      name: 'B',
      creator: null,
      cost: 100,
      pledgeName: null,
      pledgeCost: null,
      link: null,
      photoFileIds: [],
      fileFileIds: [],
    });
    const rows = await listKickstarters(db);
    expect(rows[0]!.id).toBe(id2);
    expect(rows[1]!.id).toBe(id1);
  });
});

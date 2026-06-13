import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  findActiveLink,
  findLatestForUser,
  insertInvitation,
  listForUser,
  markUsed,
} from '../../src/features/invitations/repo';

import { setupTestDb } from './setup';

describe('invitations.repo', () => {
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

  it('insertInvitation + findActiveLink round-trip', async () => {
    const id = await insertInvitation(db, {
      userId: 1,
      groupPeriod: '2026_05',
      groupType: 'regular',
      telegramInviteLink: 'https://t.me/+abc',
      telegramMetadata: { is_primary: false },
      createsJoinRequest: true,
    });
    const active = await findActiveLink(db, 1, '2026_05', 'regular');
    expect(active?.id).toBe(id);
    expect(active?.telegramInviteLink).toBe('https://t.me/+abc');
  });

  it('markUsed flips used_at and increments use_count', async () => {
    const id = await insertInvitation(db, {
      userId: 1,
      groupPeriod: '2026_05',
      groupType: 'regular',
      telegramInviteLink: 'https://t.me/+abc',
      telegramMetadata: {},
      createsJoinRequest: true,
    });
    await markUsed(db, id);
    const active = await findActiveLink(db, 1, '2026_05', 'regular');
    expect(active).toBeUndefined(); // no longer "active" (used_at is set)
    const latest = await findLatestForUser(db, 1, '2026_05', 'regular');
    expect(latest?.usedAt).not.toBeNull();
    expect(latest?.useCount).toBe(1);
  });

  it('listForUser returns descending by created_at', async () => {
    await insertInvitation(db, {
      userId: 1,
      groupPeriod: '2026_05',
      groupType: 'regular',
      telegramInviteLink: 'https://t.me/+a',
      telegramMetadata: {},
      createsJoinRequest: true,
    });
    await insertInvitation(db, {
      userId: 1,
      groupPeriod: '2026_06',
      groupType: 'plus',
      telegramInviteLink: 'https://t.me/+b',
      telegramMetadata: {},
      createsJoinRequest: true,
    });
    const list = await listForUser(db, 1);
    expect(list[0]!.groupPeriod).toBe('2026_06');
  });
});

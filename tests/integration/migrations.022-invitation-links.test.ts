import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTestDb } from './setup';

describe('migration 022 — normalize invitation_links', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('moves Telegram fields into a JSONB column and drops originals', async () => {
    // Apply everything up to (but not including) 022
    await db.migrate.up({ name: '021_drop_dead_tables.ts' });

    await db('users').insert({ id: 1, username: 'u1' });
    await db('invitation_links').insert({
      user_id: 1,
      group_period: '2026_05',
      telegram_invite_link: 'https://t.me/+abc',
      telegram_invite_link_name: 'May2026',
      telegram_invite_link_creator_id: 999,
      telegram_invite_link_is_primary: false,
      telegram_invite_link_is_revoked: false,
      telegram_invite_link_member_limit: 1,
    });

    await db.migrate.up({ name: '022_normalize_invitation_links.ts' });

    const row = await db('invitation_links').where({ user_id: 1 }).first();
    expect(row.telegram_metadata).toBeDefined();
    expect(row.telegram_metadata.name).toBe('May2026');
    expect(Number(row.telegram_metadata.creator_id)).toBe(999);
    expect(row.telegram_metadata.is_primary).toBe(false);
    expect(Number(row.telegram_metadata.member_limit)).toBe(1);

    // Old columns gone
    expect(await db.schema.hasColumn('invitation_links', 'telegram_invite_link_name')).toBe(false);
  });

  it('down-migration restores typed columns and backfills from JSONB', async () => {
    await db.migrate.latest();

    await db('users').insert({ id: 1, username: 'u1' });
    await db('invitation_links').insert({
      user_id: 1,
      group_period: '2026_05',
      telegram_invite_link: 'https://t.me/+xyz',
      telegram_metadata: JSON.stringify({
        name: 'Jun2026',
        creator_id: 777,
        is_primary: true,
        is_revoked: false,
        expire_date: null,
        member_limit: 1,
      }),
    });

    await db.migrate.down({ name: '022_normalize_invitation_links.ts' });

    const row = await db('invitation_links').where({ user_id: 1 }).first();
    expect(row.telegram_invite_link_name).toBe('Jun2026');
    expect(Number(row.telegram_invite_link_creator_id)).toBe(777);
    expect(row.telegram_invite_link_is_primary).toBe(true);
  });
});

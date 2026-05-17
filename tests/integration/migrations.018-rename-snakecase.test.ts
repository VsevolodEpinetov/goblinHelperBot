import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTestDb } from './setup';

const M_017 = '017_create_retroactive_tables.ts';
const M_018 = '018_rename_camelcase_to_snakecase.ts';

describe('migration 018 — camelCase to snake_case rename', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renames userPurchases -> user_purchases and preserves data', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({
      id: 1,
      username: 'u1',
      firstName: 'Alice',
      lastName: 'A',
    });
    await db('userPurchases').insert({ userId: 1, balance: 100 });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('userPurchases')).toBe(false);
    expect(await db.schema.hasTable('user_purchases')).toBe(true);

    const row = await db('user_purchases').where('user_id', 1).first();
    expect(row).toBeDefined();
    expect(Number(row.balance)).toBe(100);
  });

  it('renames paymentTracking -> payment_tracking with all columns snake-cased', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 1, username: 'u1' });
    await db('paymentTracking').insert({
      userId: 1,
      type: 'subscription',
      subscriptionType: 'regular',
      period: '2026_05',
      amount: 100,
      currency: 'XTR',
      status: 'completed',
      telegramPaymentChargeId: 'ch_abc',
      isUpgrade: false,
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('paymentTracking')).toBe(false);
    expect(await db.schema.hasTable('payment_tracking')).toBe(true);

    const row = await db('payment_tracking').where('user_id', 1).first();
    expect(row.telegram_payment_charge_id).toBe('ch_abc');
    expect(row.subscription_type).toBe('regular');
    expect(row.is_upgrade).toBe(false);
  });

  it('down-migration restores camelCase shape', async () => {
    await db.migrate.latest();
    await db.migrate.down({ name: M_018 });

    expect(await db.schema.hasTable('userPurchases')).toBe(true);
    expect(await db.schema.hasTable('paymentTracking')).toBe(true);
    expect(await db.schema.hasTable('user_purchases')).toBe(false);
    expect(await db.schema.hasTable('payment_tracking')).toBe(false);
  });

  it('renames months.chatId/counterJoined/counterPaid/createdAt to snake_case', async () => {
    await db.migrate.up({ name: M_017 });

    await db('months').insert({
      period: '2026_05',
      type: 'regular',
      chatId: 12345,
      counterJoined: 0,
      counterPaid: 0,
    });

    await db.migrate.up({ name: M_018 });

    const row = await db('months').where('period', '2026_05').first();
    expect(Number(row.chat_id)).toBe(12345);
    expect(row.counter_joined).toBe(0);
    expect(row.counter_paid).toBe(0);
  });

  it('renames kickstarters.pledgeName/pledgeCost/createdAt to snake_case', async () => {
    await db.migrate.up({ name: M_017 });

    await db('kickstarters').insert({
      name: 'Test',
      creator: 'X',
      cost: 100,
      pledgeName: 'Standard',
      pledgeCost: 50,
    });

    await db.migrate.up({ name: M_018 });

    const row = await db('kickstarters').where('name', 'Test').first();
    expect(row.pledge_name).toBe('Standard');
    expect(row.pledge_cost).toBe(50);
  });

  it('renames userRoles -> user_roles with userId -> user_id', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 2, username: 'u2' });
    await db('userRoles').insert({ userId: 2, role: 'goblin' });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('userRoles')).toBe(false);
    expect(await db.schema.hasTable('user_roles')).toBe(true);

    const row = await db('user_roles').where('user_id', 2).first();
    expect(row.role).toBe('goblin');
  });

  it('renames userGroups -> user_groups with userId -> user_id', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 3, username: 'u3' });
    await db('userGroups').insert({ userId: 3, period: '2026_05', type: 'regular' });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('userGroups')).toBe(false);
    expect(await db.schema.hasTable('user_groups')).toBe(true);

    const row = await db('user_groups').where('user_id', 3).first();
    expect(row.period).toBe('2026_05');
    expect(row.type).toBe('regular');
  });

  it('renames userKickstarters -> user_kickstarters with both FK columns snake-cased', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 4, username: 'u4' });
    await db('kickstarters').insert({ id: 1, name: 'KS1', creator: 'C', cost: 10 });
    await db('userKickstarters').insert({ userId: 4, kickstarterId: 1 });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('userKickstarters')).toBe(false);
    expect(await db.schema.hasTable('user_kickstarters')).toBe(true);

    const row = await db('user_kickstarters').where('user_id', 4).first();
    expect(row.kickstarter_id).toBe(1);
  });

  it('renames invitationLinks -> invitation_links with all telegram* columns snake-cased', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 5, username: 'u5' });
    await db('invitationLinks').insert({
      userId: 5,
      groupPeriod: '2026_05',
      groupType: 'main',
      telegramInviteLink: 'https://t.me/+abc',
      telegramInviteLinkName: 'name1',
      telegramInviteLinkIsPrimary: false,
      telegramInviteLinkIsRevoked: false,
      telegramInviteLinkMemberLimit: 1,
      createsJoinRequest: true,
      useCount: 0,
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('invitationLinks')).toBe(false);
    expect(await db.schema.hasTable('invitation_links')).toBe(true);

    const row = await db('invitation_links').where('user_id', 5).first();
    expect(row.group_period).toBe('2026_05');
    expect(row.group_type).toBe('main');
    expect(row.telegram_invite_link).toBe('https://t.me/+abc');
    expect(row.telegram_invite_link_name).toBe('name1');
    expect(row.creates_join_request).toBe(true);
    expect(row.use_count).toBe(0);
  });

  it('renames kickstarterPromoMessages -> kickstarter_promo_messages preserving data', async () => {
    await db.migrate.up({ name: M_017 });

    await db('kickstarters').insert({ id: 1, name: 'KS1', creator: 'C', cost: 10 });
    await db('kickstarterPromoMessages').insert({
      kickstarterId: 1,
      messageId: 999,
      chatId: 12345,
      topicId: null,
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('kickstarterPromoMessages')).toBe(false);
    expect(await db.schema.hasTable('kickstarter_promo_messages')).toBe(true);

    const row = await db('kickstarter_promo_messages').where('kickstarter_id', 1).first();
    expect(Number(row.message_id)).toBe(999);
    expect(Number(row.chat_id)).toBe(12345);
  });

  it('renames userScrolls -> user_scrolls preserving data', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 6, username: 'u6' });
    await db('userScrolls').insert({
      userId: 6,
      scrollId: 'bonus_2026',
      amount: 5,
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('userScrolls')).toBe(false);
    expect(await db.schema.hasTable('user_scrolls')).toBe(true);

    const row = await db('user_scrolls').where('user_id', 6).first();
    expect(row.scroll_id).toBe('bonus_2026');
    expect(row.amount).toBe(5);
  });

  it('renames scrollLogs -> scroll_logs preserving data', async () => {
    await db.migrate.up({ name: M_017 });

    await db('users').insert({ id: 7, username: 'u7' });
    await db('scrollLogs').insert({
      userId: 7,
      scrollId: 'bonus_2026',
      action: 'add',
      amount: 1,
      reason: 'manual',
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('scrollLogs')).toBe(false);
    expect(await db.schema.hasTable('scroll_logs')).toBe(true);

    const row = await db('scroll_logs').where('user_id', 7).first();
    expect(row.scroll_id).toBe('bonus_2026');
    expect(row.action).toBe('add');
  });

  it('renames kickstarterPhotos -> kickstarter_photos preserving data', async () => {
    await db.migrate.up({ name: M_017 });

    await db('kickstarters').insert({ id: 1, name: 'KS1', creator: 'C', cost: 10 });
    await db('kickstarterPhotos').insert({
      kickstarterId: 1,
      ord: 0,
      fileId: 'photo_file_abc',
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('kickstarterPhotos')).toBe(false);
    expect(await db.schema.hasTable('kickstarter_photos')).toBe(true);

    const row = await db('kickstarter_photos').where('kickstarter_id', 1).first();
    expect(row.file_id).toBe('photo_file_abc');
  });

  it('renames kickstarterFiles -> kickstarter_files preserving data', async () => {
    await db.migrate.up({ name: M_017 });

    await db('kickstarters').insert({ id: 1, name: 'KS1', creator: 'C', cost: 10 });
    await db('kickstarterFiles').insert({
      kickstarterId: 1,
      ord: 0,
      fileId: 'doc_file_xyz',
    });

    await db.migrate.up({ name: M_018 });

    expect(await db.schema.hasTable('kickstarterFiles')).toBe(false);
    expect(await db.schema.hasTable('kickstarter_files')).toBe(true);

    const row = await db('kickstarter_files').where('kickstarter_id', 1).first();
    expect(row.file_id).toBe('doc_file_xyz');
  });

  it('is idempotent — running up twice does not throw', async () => {
    await db.migrate.up({ name: M_017 });
    await db.migrate.up({ name: M_018 });
    // Re-running migrate.latest() after 018 is already applied should no-op.
    await db.migrate.latest();

    expect(await db.schema.hasTable('user_purchases')).toBe(true);
    expect(await db.schema.hasTable('userPurchases')).toBe(false);
  });
});

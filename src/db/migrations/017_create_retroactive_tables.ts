import type { Knex } from 'knex';

/**
 * Migration 017 — Retroactive table documentation.
 *
 * The tables `users`, `months`, `kickstarters`, `applications`, and `settings`
 * exist in production but were never created by a tracked migration (they
 * predate the migrations directory). This migration documents their canonical
 * schema so that a fresh environment (e.g. integration tests, new dev box)
 * can stand them up from scratch.
 *
 * Every create is guarded by `hasTable` so the migration is a no-op against
 * a production database where these tables already exist.
 *
 * Column definitions were derived by reading every legacy module that touches
 * each table — primarily `modules/db/helpers.js`, `modules/users/actions/*`,
 * `modules/admin/scenes/requests.js`, and `modules/admin/actions/users/*`.
 */
export async function up(knex: Knex): Promise<void> {
  // users — keyed by Telegram user_id (bigInteger), so id is NOT auto-increment.
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.bigInteger('id').primary();
      table.string('username').nullable();
      table.string('firstName').nullable();
      table.string('lastName').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
    });
  }

  // months — production stores year+month as a single underscore-joined
  // `period` string (e.g. '2024_01'), keyed together with `type`.
  // See helpers.js#getMonths and helpers.js#updateMonth.
  if (!(await knex.schema.hasTable('months'))) {
    await knex.schema.createTable('months', (table) => {
      table.increments('id').primary();
      table.string('period').notNullable();
      table.string('type').notNullable(); // 'regular' or 'plus'
      table.bigInteger('chatId').nullable();
      table.integer('counterJoined').defaultTo(0);
      table.integer('counterPaid').defaultTo(0);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.unique(['period', 'type']);
    });
  }

  // kickstarters — see helpers.js#getKickstarters and #addKickstarter for
  // the column list. Note: migration 016 retrofits the id column with a
  // sequence default; here on a fresh DB `increments` covers that natively.
  if (!(await knex.schema.hasTable('kickstarters'))) {
    await knex.schema.createTable('kickstarters', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('creator').nullable();
      table.integer('cost').nullable();
      table.string('pledgeName').nullable();
      table.integer('pledgeCost').nullable();
      table.string('link').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
    });
  }

  // applications — see modules/users/actions/applyYes.js,
  // modules/admin/actions/createApplication.js, and migration 010
  // (which adds the invitationCode column).
  if (!(await knex.schema.hasTable('applications'))) {
    await knex.schema.createTable('applications', (table) => {
      table.increments('id').primary();
      table.bigInteger('userId').notNullable();
      table.string('username').nullable();
      table.string('firstName').nullable();
      table.string('lastName').nullable();
      table.string('status').defaultTo('pending');
      table.string('invitationCode', 20).nullable().unique();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.index('invitationCode');
    });
  }

  // settings — simple key/value store. See helpers.js#getSetting / #setSetting.
  if (!(await knex.schema.hasTable('settings'))) {
    await knex.schema.createTable('settings', (table) => {
      table.string('key').primary();
      table.text('value').nullable();
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Symmetric drops for fresh-environment teardown. In production this
  // migration is a no-op (tables already exist), so down() is mainly
  // useful for the integration test harness.
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('applications');
  await knex.schema.dropTableIfExists('kickstarters');
  await knex.schema.dropTableIfExists('months');
  await knex.schema.dropTableIfExists('users');
}

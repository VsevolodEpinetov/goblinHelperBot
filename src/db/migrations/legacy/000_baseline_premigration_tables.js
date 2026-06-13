/**
 * Baseline for FRESH databases only.
 *
 * Production predates the migrations directory: several tables already
 * existed before 001 ran, and the legacy chain references them (003/004 add
 * FKs to users, 009/015 alter userPurchases, 010 alters applications,
 * 014/016 add FKs to kickstarters). On a fresh database the chain broke at
 * 003 because migration 017 — which documents some of these tables — sorts
 * after the legacy files, and the helpers.js-era tables (userPurchases,
 * userRoles, userGroups, userKickstarters) were never documented at all.
 *
 * This baseline creates all of them in their PRE-chain shape so the legacy
 * migrations replay exactly as they did in production: applications without
 * invitationCode (010 adds it), kickstarters without an id sequence default
 * (016 retrofits it), userPurchases with ticketsSpent (009 renames it,
 * 015 drops it). months/settings are not referenced by any legacy migration,
 * so 017 still creates those on a fresh DB. Shapes and enum types mirror
 * db_dumps/goblin_prod.dump.
 *
 * Every create is guarded (hasTable / duplicate_object), so on an existing
 * production database — where this file shows up as pending even though
 * 001-017 are already recorded — it is a strict no-op. The helpers.js-era
 * tables are guarded against BOTH their original camelCase names and the
 * snake_case names migration 018 renames them to, since on production 018
 * has already run by the time this baseline is applied.
 */
async function missingTable(knex, ...names) {
  for (const name of names) {
    if (await knex.schema.hasTable(name)) return false;
  }
  return true;
}

exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      CREATE TYPE "userRole" AS ENUM (
        'admin', 'adminPlus', 'rejected', 'banned', 'user', 'goblin',
        'polls', 'super', 'prereg', 'pending', 'selfbanned', 'preapproved',
        'adminPolls', 'protector', 'departed'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      CREATE TYPE "groupType" AS ENUM ('regular', 'plus', 'main');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.bigInteger('id').primary();
      table.string('username').nullable();
      table.string('firstName').nullable();
      table.string('lastName').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('applications'))) {
    await knex.schema.createTable('applications', (table) => {
      table.increments('id').primary();
      table.bigInteger('userId').notNullable();
      table.string('username').nullable();
      table.string('firstName').nullable();
      table.string('lastName').nullable();
      table.string('status').defaultTo('pending');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    });
  }

  if (!(await knex.schema.hasTable('kickstarters'))) {
    await knex.schema.createTable('kickstarters', (table) => {
      table.integer('id').primary();
      table.string('name').notNullable();
      table.string('creator').nullable();
      table.integer('cost').nullable();
      table.string('pledgeName').nullable();
      table.integer('pledgeCost').nullable();
      table.string('link').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
    });
  }

  if (await missingTable(knex, 'userPurchases', 'user_purchases')) {
    await knex.schema.createTable('userPurchases', (table) => {
      table.bigInteger('userId').primary();
      table.integer('balance').notNullable().defaultTo(0);
      table.integer('ticketsSpent').notNullable().defaultTo(0);
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    });
  }

  if (await missingTable(knex, 'userRoles', 'user_roles')) {
    await knex.schema.createTable('userRoles', (table) => {
      table.bigInteger('userId').notNullable();
      table.specificType('role', '"userRole"').notNullable();
      table.primary(['userId', 'role']);
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    });
  }

  if (await missingTable(knex, 'userGroups', 'user_groups')) {
    await knex.schema.createTable('userGroups', (table) => {
      table.bigInteger('userId').notNullable();
      table.text('period').notNullable();
      table.specificType('type', '"groupType"').notNullable();
      table.primary(['userId', 'period', 'type']);
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.index(['period', 'type']);
      table.index('userId');
    });
  }

  if (await missingTable(knex, 'userKickstarters', 'user_kickstarters')) {
    await knex.schema.createTable('userKickstarters', (table) => {
      table.bigInteger('userId').notNullable();
      table.integer('kickstarterId').notNullable();
      table.timestamp('acquiredAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.text('acquiredBy').defaultTo('ticket');
      table.primary(['userId', 'kickstarterId']);
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('kickstarterId').references('id').inTable('kickstarters').onDelete('CASCADE');
      table.index('userId');
      table.index('kickstarterId');
    });
  }
};

exports.down = async function () {
  // Never drop: on production these tables predate the migration and hold
  // live data, and on a fresh DB the test harness drops the whole database.
};

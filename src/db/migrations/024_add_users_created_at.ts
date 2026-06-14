import type { Knex } from 'knex';

/**
 * Migration 024 — add the missing `created_at` column to `users`.
 *
 * On a fresh build, `users` is created with a `createdAt` column (017) which
 * 018 renames to `created_at`. But in production the `users` table predates the
 * migrations directory: it was created by the legacy JS app, so the `hasTable`
 * guards in 000/017 skipped it and 018's `hasColumn('createdAt')` rename was a
 * no-op. The result is a production `users` table with no created-timestamp
 * column at all — yet the rewrite's repos (searchUsers, getUserById) order by
 * and select `created_at`, which fails with `column "created_at" does not exist`.
 *
 * This adds the column when absent, matching 017's definition so retro-fixed
 * and fresh-built databases end up schema-identical. Existing rows are
 * backfilled with the migration-time timestamp by the default.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'created_at'))) {
    await knex.schema.alterTable('users', (t) => {
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'created_at')) {
    await knex.schema.alterTable('users', (t) => {
      t.dropColumn('created_at');
    });
  }
}

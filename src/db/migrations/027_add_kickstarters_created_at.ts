import type { Knex } from 'knex';

/**
 * Migration 027 — add the missing `created_at` column to `kickstarters`.
 *
 * Mirrors 024 (which fixed the same gap on `users`). On a fresh build the table
 * gets `createdAt` (017) which 018 renames to `created_at`. But the production
 * `kickstarters` table predates the migrations directory — it was created by
 * the legacy JS app, so 017's `hasTable` guard skipped it and 018's
 * `hasColumn('createdAt')` rename was a no-op. The result is a production table
 * with no created-timestamp column, yet the rewrite's repo orders by and
 * selects `created_at` — `column "created_at" does not exist` whenever the
 * catalogue is opened.
 *
 * This adds the column when absent, matching 017's definition; existing rows
 * are backfilled with the migration-time timestamp by the default.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('kickstarters', 'created_at'))) {
    await knex.schema.alterTable('kickstarters', (t) => {
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('kickstarters', 'created_at')) {
    await knex.schema.alterTable('kickstarters', (t) => {
      t.dropColumn('created_at');
    });
  }
}

import type { Knex } from 'knex';

/**
 * Migration 026 — make `kickstarters.pledge_name` / `pledge_cost` nullable.
 *
 * The add wizard no longer asks for a pledge, so it inserts NULL for both. On a
 * fresh build these columns are already nullable (017), but the production
 * table came from the legacy dump where they were NOT NULL — inserting a
 * pledge-less kickstarter failed with
 * `null value in column "pledge_cost" ... violates not-null constraint`.
 *
 * `DROP NOT NULL` is idempotent (a no-op when the column is already nullable),
 * so this is safe on both fresh and production databases.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE "kickstarters" ALTER COLUMN "pledge_name" DROP NOT NULL');
  await knex.raw('ALTER TABLE "kickstarters" ALTER COLUMN "pledge_cost" DROP NOT NULL');
}

export async function down(): Promise<void> {
  // Re-imposing NOT NULL would fail wherever pledge-less rows exist, and the
  // app treats these as optional, so the rollback is intentionally a no-op.
}

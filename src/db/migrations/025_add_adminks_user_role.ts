import type { Knex } from 'knex';

/**
 * Migration 025 — add `adminKs` to the `userRole` enum.
 *
 * The rewrite added an `adminKs` delegate role (trusted kickstarter uploader),
 * but `user_roles.role` is a Postgres enum (`userRole`) whose values come from
 * the legacy dump — so granting `adminKs` failed with
 * `invalid input value for enum "userRole": "adminKs"`. This adds the value.
 *
 * `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on older
 * Postgres, so this migration opts out of knex's per-migration transaction.
 * `IF NOT EXISTS` makes it idempotent and safe on a fresh build (where 000
 * already created the type) as well as on production.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TYPE "userRole" ADD VALUE IF NOT EXISTS 'adminKs'`);
}

export async function down(): Promise<void> {
  // Postgres has no DROP VALUE for enums; removing one means recreating the
  // type and rewriting every dependent column. The extra value is harmless, so
  // the rollback is intentionally a no-op.
}

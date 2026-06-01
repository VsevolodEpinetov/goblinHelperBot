import type { Knex } from 'knex';

/**
 * Migration 019 — Payment + XP idempotency constraints.
 *
 * Adds:
 *   - `payment_tracking.source` (text, default 'stars') — discriminator for
 *     payment provider (e.g. 'stars', 'sbp', 'manual').
 *   - Partial UNIQUE index on `payment_tracking.telegram_payment_charge_id`,
 *     skipping NULL so legacy pre-charge-id rows do not collide.
 *   - `xp_transactions.external_id` (text, nullable) — provider-side reference
 *     used to de-duplicate XP grants from external events.
 *   - Partial UNIQUE index on `xp_transactions (source, external_id)`, skipping
 *     rows where `external_id` is NULL so non-idempotent legacy entries are
 *     unaffected.
 *
 * `xp_transactions.source` already exists (migration 007 created it as a
 * NOT NULL varchar(50) discriminator), so we only add `external_id` here.
 *
 * Idempotent: every step is guarded by `hasColumn` or `IF NOT EXISTS`.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // payment_tracking.source — new column.
    const hasSource = await trx.schema.hasColumn('payment_tracking', 'source');
    if (!hasSource) {
      await trx.schema.alterTable('payment_tracking', (t) => {
        t.string('source').defaultTo('stars');
      });
    }

    // Backfill source for any pre-existing rows. Use currency as the
    // discriminator: XTR → 'stars', RUB → 'sbp', anything else → 'manual'.
    // This is more accurate than the previous blanket 'stars' default, which
    // would have miscategorised legacy SBP payments and broken refund
    // eligibility downstream.
    await trx('payment_tracking')
      .whereNull('source')
      .where('currency', 'XTR')
      .update({ source: 'stars' });
    await trx('payment_tracking')
      .whereNull('source')
      .where('currency', 'RUB')
      .update({ source: 'sbp' });
    await trx('payment_tracking').whereNull('source').update({ source: 'manual' });

    // Resolve historical duplicates BEFORE creating the UNIQUE index. The
    // legacy bot stamped a single Telegram charge id onto several of a user's
    // payment rows (same user/period/tier — verified against the prod dump).
    // A Telegram charge id is globally unique per real payment, so the extra
    // rows reflect no additional money. Keep the earliest (MIN id) per charge
    // id and drop the rest. Mirrors the dedupe in migration 020. NULL charge
    // ids (legacy pre-charge-id rows) are left untouched.
    await trx.raw(`
      DELETE FROM payment_tracking
      WHERE telegram_payment_charge_id IS NOT NULL
        AND id NOT IN (
          SELECT MIN(id) FROM payment_tracking
          WHERE telegram_payment_charge_id IS NOT NULL
          GROUP BY telegram_payment_charge_id
        )
    `);

    // Partial UNIQUE on telegram_payment_charge_id — skip NULLs so legacy
    // rows without a charge id do not block one another.
    await trx.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS payment_tracking_charge_id_unique
       ON payment_tracking (telegram_payment_charge_id)
       WHERE telegram_payment_charge_id IS NOT NULL`,
    );

    // xp_transactions.external_id — new column.
    const hasExternalId = await trx.schema.hasColumn('xp_transactions', 'external_id');
    if (!hasExternalId) {
      await trx.schema.alterTable('xp_transactions', (t) => {
        t.string('external_id').nullable();
      });
    }

    // Partial UNIQUE on (source, external_id) — only when external_id is set.
    await trx.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS xp_transactions_source_external_id_unique
       ON xp_transactions (source, external_id)
       WHERE external_id IS NOT NULL`,
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.raw('DROP INDEX IF EXISTS xp_transactions_source_external_id_unique');
    if (await trx.schema.hasColumn('xp_transactions', 'external_id')) {
      await trx.schema.alterTable('xp_transactions', (t) => {
        t.dropColumn('external_id');
      });
    }
    await trx.raw('DROP INDEX IF EXISTS payment_tracking_charge_id_unique');
    if (await trx.schema.hasColumn('payment_tracking', 'source')) {
      await trx.schema.alterTable('payment_tracking', (t) => {
        t.dropColumn('source');
      });
    }
  });
}

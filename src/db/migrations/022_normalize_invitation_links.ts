import type { Knex } from 'knex';

const TELEGRAM_COLUMNS = [
  'telegram_invite_link_name',
  'telegram_invite_link_creator_id',
  'telegram_invite_link_is_primary',
  'telegram_invite_link_is_revoked',
  'telegram_invite_link_expire_date',
  'telegram_invite_link_member_limit',
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Add JSONB column
    if (!(await trx.schema.hasColumn('invitation_links', 'telegram_metadata'))) {
      await trx.schema.alterTable('invitation_links', (t) => {
        t.jsonb('telegram_metadata').nullable();
      });
    }

    // Backfill from the typed columns
    await trx.raw(`
      UPDATE invitation_links
      SET telegram_metadata = jsonb_build_object(
        'name', telegram_invite_link_name,
        'creator_id', telegram_invite_link_creator_id,
        'is_primary', telegram_invite_link_is_primary,
        'is_revoked', telegram_invite_link_is_revoked,
        'expire_date', telegram_invite_link_expire_date,
        'member_limit', telegram_invite_link_member_limit
      )
      WHERE telegram_metadata IS NULL
    `);

    // Drop the original typed columns
    await trx.schema.alterTable('invitation_links', (t) => {
      for (const col of TELEGRAM_COLUMNS) {
        t.dropColumn(col);
      }
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Recreate the typed columns
    await trx.schema.alterTable('invitation_links', (t) => {
      t.string('telegram_invite_link_name').nullable();
      t.bigInteger('telegram_invite_link_creator_id').nullable();
      t.boolean('telegram_invite_link_is_primary').nullable();
      t.boolean('telegram_invite_link_is_revoked').nullable();
      t.timestamp('telegram_invite_link_expire_date').nullable();
      t.integer('telegram_invite_link_member_limit').nullable();
    });

    // Restore values from JSONB. Use the `->` operator (NOT `->>`) so a
    // JSON null comes back as SQL NULL — `->>` would coerce JSON null to
    // the string 'null', and NULLIF('null','')::bigint then throws.
    // Casting via ::text in the middle is the standard pattern to convert
    // jsonb scalars to the typed columns while preserving NULLs.
    await trx.raw(`
      UPDATE invitation_links
      SET
        telegram_invite_link_name        = (telegram_metadata->>'name'),
        telegram_invite_link_creator_id  = (telegram_metadata->'creator_id')::text::bigint,
        telegram_invite_link_is_primary  = (telegram_metadata->'is_primary')::text::boolean,
        telegram_invite_link_is_revoked  = (telegram_metadata->'is_revoked')::text::boolean,
        telegram_invite_link_expire_date = (telegram_metadata->'expire_date')::text::timestamp,
        telegram_invite_link_member_limit = (telegram_metadata->'member_limit')::text::int
      WHERE telegram_metadata IS NOT NULL
    `);

    await trx.schema.alterTable('invitation_links', (t) => {
      t.dropColumn('telegram_metadata');
    });
  });
}

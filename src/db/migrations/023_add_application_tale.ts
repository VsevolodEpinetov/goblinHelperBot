import type { Knex } from 'knex';

/**
 * Migration 023 — applicant's free-text "tale".
 *
 * The onboarding обряд now asks the чужак to write about themselves in their
 * own words; that text is stored here and shown to the совет on the review
 * card. Nullable so existing rows (which predate the feature) stay valid.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('applications', 'tale'))) {
    await knex.schema.alterTable('applications', (t) => {
      t.text('tale').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('applications', 'tale')) {
    await knex.schema.alterTable('applications', (t) => {
      t.dropColumn('tale');
    });
  }
}

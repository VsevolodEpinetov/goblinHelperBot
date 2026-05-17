import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Dedupe: keep the lowest-id row per (user_id, achievement_type)
    await trx.raw(`
      DELETE FROM user_achievements
      WHERE id NOT IN (
        SELECT MIN(id) FROM user_achievements
        GROUP BY user_id, achievement_type
      )
    `);

    await trx.raw(`
      ALTER TABLE user_achievements
      ADD CONSTRAINT user_achievements_user_id_achievement_type_unique
      UNIQUE (user_id, achievement_type)
    `);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE user_achievements
    DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_type_unique
  `);
}

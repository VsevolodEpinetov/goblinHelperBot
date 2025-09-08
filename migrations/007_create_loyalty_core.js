/**
 * Loyalty Core Schema (XP-based)
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('user_levels', (table) => {
      table.bigInteger('user_id').primary();
      table.string('current_tier', 20).notNullable().defaultTo('wood');
      table.integer('current_level').notNullable().defaultTo(1); // 1-10 (legend 1+)
      table.integer('total_xp').notNullable().defaultTo(0);
      table.decimal('total_spending_units', 14, 2).notNullable().defaultTo(0); // S in units
      table.integer('xp_to_next_level');
      table.timestamp('level_up_date');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['current_tier', 'current_level']);
    })
    .createTable('xp_transactions', (table) => {
      table.increments('id').primary();
      table.bigInteger('user_id').notNullable();
      table.integer('amount').notNullable(); // XP delta (+/-)
      table.string('source', 50).notNullable(); // 'spending_payment', 'donation', 'raid_complete', etc.
      table.text('description');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['user_id', 'created_at']);
    })
    .createTable('user_achievements', (table) => {
      table.increments('id').primary();
      table.bigInteger('user_id').notNullable();
      table.string('achievement_type', 50).notNullable(); // e.g., 'years_of_service'
      table.jsonb('achievement_data');
      table.timestamp('unlocked_at').defaultTo(knex.fn.now());
      table.boolean('is_public').defaultTo(true);
      table.index(['user_id', 'achievement_type']);
    })
    .createTable('level_management_log', (table) => {
      table.increments('id').primary();
      table.bigInteger('admin_user_id').notNullable();
      table.bigInteger('target_user_id').notNullable();
      table.string('action_type', 50).notNullable(); // 'set_level','grant_xp','adjust_tier','bulk_operation','grant_achievement','revoke_achievement'
      table.string('old_tier', 20);
      table.integer('old_level');
      table.integer('old_xp');
      table.string('new_tier', 20);
      table.integer('new_level');
      table.integer('new_xp');
      table.text('reason');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['target_user_id', 'created_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('level_management_log')
    .dropTableIfExists('user_achievements')
    .dropTableIfExists('xp_transactions')
    .dropTableIfExists('user_levels');
};



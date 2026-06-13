/**
 * Create promo system tables
 * Handles promo files and user cooldown tracking
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('promo_files', (table) => {
      table.increments('id').primary();
      table.string('file_id').notNullable().unique();
      table.string('file_type', 20).notNullable(); // 'photo', 'video', 'document', 'animation', 'sticker'
      table.string('file_name', 255).nullable();
      table.integer('file_size').nullable();
      table.timestamp('uploaded_at').defaultTo(knex.fn.now());
      table.bigInteger('uploaded_by').notNullable(); // admin user who uploaded
      table.boolean('is_active').defaultTo(true);
      table.index(['is_active', 'file_type']);
    })
    .createTable('user_promo_usage', (table) => {
      table.increments('id').primary();
      table.bigInteger('user_id').notNullable();
      table.integer('promo_file_id').notNullable();
      table.timestamp('used_at').defaultTo(knex.fn.now());
      table.timestamp('cooldown_until').notNullable(); // 48 hours from used_at
      table.index(['user_id', 'cooldown_until']);
      table.foreign('promo_file_id').references('id').inTable('promo_files').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_promo_usage')
    .dropTableIfExists('promo_files');
};

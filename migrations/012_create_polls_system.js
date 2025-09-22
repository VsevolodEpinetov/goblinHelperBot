/**
 * Migration: Create polls system tables
 * 
 * Simple polls system with core studios and dynamic studios
 */

exports.up = async function(knex) {
  // Create polls_core_studios table (static core studios from studios.json)
  await knex.schema.createTable('polls_core_studios', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable().unique();
    table.integer('price').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Create polls_studios table (dynamic studios added via + command)
  await knex.schema.createTable('polls_studios', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable().unique();
    table.integer('price').defaultTo(0);
    table.timestamp('added_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('polls_studios');
  await knex.schema.dropTableIfExists('polls_core_studios');
};

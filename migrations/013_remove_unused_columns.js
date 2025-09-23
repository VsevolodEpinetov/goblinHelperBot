/**
 * Migration: Remove unused columns from polls tables
 * 
 * Removes:
 * - is_active column from polls_core_studios
 * - price column from polls_core_studios
 * - price column from polls_studios
 */

exports.up = async function(knex) {
  // Remove is_active column from polls_core_studios
  await knex.schema.alterTable('polls_core_studios', (table) => {
    table.dropColumn('is_active');
  });

  // Remove price column from polls_core_studios
  await knex.schema.alterTable('polls_core_studios', (table) => {
    table.dropColumn('price');
  });

  // Remove price column from polls_studios
  await knex.schema.alterTable('polls_studios', (table) => {
    table.dropColumn('price');
  });
};

exports.down = async function(knex) {
  // Add back price column to polls_studios
  await knex.schema.alterTable('polls_studios', (table) => {
    table.integer('price').defaultTo(0);
  });

  // Add back price column to polls_core_studios
  await knex.schema.alterTable('polls_core_studios', (table) => {
    table.integer('price').notNullable();
  });

  // Add back is_active column to polls_core_studios
  await knex.schema.alterTable('polls_core_studios', (table) => {
    table.boolean('is_active').defaultTo(true);
  });
};

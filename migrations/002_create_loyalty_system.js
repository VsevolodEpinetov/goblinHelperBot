/**
 * Migration: Create basic loyalty system table
 */

exports.up = function(knex) {
  return knex.schema
    // User loyalty levels (simplified - no points)
    .createTable('userLoyalty', function(table) {
      table.increments('id').primary();
      table.bigInteger('userId').notNullable();
      table.string('level', 20).defaultTo('bronze_3');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      // Indexes
      table.index(['userId']);
      table.index(['level']);
      table.unique(['userId']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTable('userLoyalty');
};

/**
 * Migration: Create userRoles table
 * This table stores the role assignments for users
 */

exports.up = function(knex) {
  return knex.schema.createTable('userRoles', function(table) {
    // Primary key
    table.increments('id').primary();
    
    // User ID (foreign key to users table)
    table.bigInteger('userId').notNullable();
    
    // Role name
    table.string('role', 50).notNullable();
    
    // Timestamps
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['userId']);
    table.index(['role']);
    table.unique(['userId', 'role']); // Prevent duplicate role assignments
    
    // Foreign key constraint (if users table exists)
    // table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('userRoles');
};

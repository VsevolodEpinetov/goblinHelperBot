/**
 * Migration: Create kickstarter promo messages, user scrolls, and scroll logs tables
 * 
 * Creates:
 * - kickstarterPromoMessages: Track promo messages sent to groups
 * - userScrolls: Track user scrolls (bonus currency)
 * - scrollLogs: Log all scroll activity
 */

exports.up = async function(knex) {
  // Create kickstarterPromoMessages table
  await knex.schema.createTable('kickstarterPromoMessages', (table) => {
    table.increments('id').primary();
    table.integer('kickstarterId').notNullable().references('id').inTable('kickstarters').onDelete('CASCADE');
    table.bigInteger('messageId').notNullable();
    table.bigInteger('chatId').notNullable();
    table.integer('topicId').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    table.index(['kickstarterId']);
    table.index(['messageId', 'chatId']);
  });

  // Create userScrolls table
  await knex.schema.createTable('userScrolls', (table) => {
    table.increments('id').primary();
    table.bigInteger('userId').notNullable();
    table.string('scrollId', 100).notNullable();
    table.integer('amount').defaultTo(0).notNullable();
    table.timestamp('lifetime').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    table.unique(['userId', 'scrollId']);
    table.index(['userId']);
    table.index(['scrollId']);
  });

  // Create scrollLogs table
  await knex.schema.createTable('scrollLogs', (table) => {
    table.increments('id').primary();
    table.bigInteger('userId').notNullable();
    table.string('scrollId', 100).notNullable();
    table.string('action', 20).notNullable(); // 'add' or 'remove'
    table.integer('amount').notNullable();
    table.text('reason').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    
    table.index(['userId']);
    table.index(['scrollId']);
    table.index(['createdAt']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('scrollLogs');
  await knex.schema.dropTableIfExists('userScrolls');
  await knex.schema.dropTableIfExists('kickstarterPromoMessages');
};


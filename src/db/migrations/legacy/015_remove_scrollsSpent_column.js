/**
 * Migration: Remove scrollsSpent column from userPurchases table
 * 
 * This column is being replaced by the new userScrolls table system
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('userPurchases', (table) => {
    table.dropColumn('scrollsSpent');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('userPurchases', (table) => {
    table.integer('scrollsSpent').defaultTo(0);
  });
};


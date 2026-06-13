/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('userPurchases', function(table) {
    table.renameColumn('ticketsSpent', 'scrollsSpent');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('userPurchases', function(table) {
    table.renameColumn('scrollsSpent', 'ticketsSpent');
  });
};

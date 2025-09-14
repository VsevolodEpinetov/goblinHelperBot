exports.up = function(knex) {
  return knex.schema.hasColumn('paymentTracking', 'isUpgrade').then((exists) => {
    if (exists) return;
    return knex.schema.alterTable('paymentTracking', function(table) {
      table.boolean('isUpgrade').defaultTo(false);
    });
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('paymentTracking', function(table) {
    table.dropColumn('isUpgrade');
  });
};

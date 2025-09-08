exports.up = function(knex) {
  return knex.schema.hasTable('paymentTracking').then((exists) => {
    if (exists) return;
    return knex.schema.createTable('paymentTracking', function(table) {
      table.increments('id').primary();
      table.bigint('userId').notNullable();
      table.string('type').notNullable(); // 'subscription'
      table.string('subscriptionType'); // 'regular' or 'plus'
      table.string('period').notNullable(); // '2025_12'
      table.integer('amount').notNullable(); // Amount in stars
      table.string('currency').notNullable(); // 'XTR'
      table.string('status').notNullable().defaultTo('pending'); // 'pending', 'completed', 'failed'
      table.bigint('invoiceMessageId'); // Telegram message ID
      table.string('telegramPaymentChargeId'); // For refunds
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('completedAt');
      
      // Foreign key
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      
      // Indexes
      table.index(['userId', 'status']);
      table.index(['period', 'subscriptionType']);
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('paymentTracking');
};

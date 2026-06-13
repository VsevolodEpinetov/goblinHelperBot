exports.up = function(knex) {
  return Promise.resolve()
    .then(() => knex.schema.hasTable('raids').then(exists => {
      if (exists) return;
      return knex.schema.createTable('raids', (table) => {
        table.increments('id').primary();
        table.string('title', 255).notNullable();
        table.text('description');
        table.string('link', 500); // Product link
        table.decimal('price', 10, 2).notNullable();
        table.string('currency', 3).defaultTo('RUB');
        table.string('status', 20).defaultTo('open'); // open, closed, cancelled, completed
        table.bigInteger('created_by').notNullable(); // Telegram user ID
        table.string('created_by_username', 100);
        table.string('created_by_first_name', 100);
        table.string('created_by_last_name', 100);
        table.string('chat_id', 50); // Telegram chat ID where raid was created
        table.string('message_id', 50); // Telegram message ID
        table.timestamp('end_date'); // Approximate end date
        table.jsonb('metadata').defaultTo('{}'); // Additional flexible data
        table.timestamps(true, true);
      });
    }))
    .then(() => knex.schema.hasTable('raid_photos').then(exists => {
      if (exists) return;
      return knex.schema.createTable('raid_photos', (table) => {
        table.increments('id').primary();
        table.integer('raid_id').unsigned().notNullable().references('id').inTable('raids').onDelete('CASCADE');
        table.string('file_id', 255).notNullable(); // Telegram file ID
        table.integer('order_index').notNullable().defaultTo(0);
        table.timestamps(true, true);
      });
    }))
    .then(() => knex.schema.hasTable('raid_participants').then(exists => {
      if (exists) return;
      return knex.schema.createTable('raid_participants', (table) => {
        table.integer('raid_id').unsigned().notNullable().references('id').inTable('raids').onDelete('CASCADE');
        table.bigInteger('user_id').notNullable(); // Telegram user ID
        table.string('username', 100);
        table.string('first_name', 100);
        table.string('last_name', 100);
        table.timestamp('joined_at').defaultTo(knex.fn.now());
        table.primary(['raid_id', 'user_id']);
      });
    }));
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('raid_participants')
    .dropTableIfExists('raid_photos')
    .dropTableIfExists('raids');
};

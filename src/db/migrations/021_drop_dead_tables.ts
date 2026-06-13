import type { Knex } from 'knex';

const TABLES_TO_DROP = [
  // Drop in reverse-dependency order: tables with FKs first, then their parents.
  'lot_tag_assignments',
  'lot_participants',
  'lot_photos',
  'user_favorites',
  'lots',
  'lot_tags',
  'lot_categories',
  'user_preferences',
  'userLoyalty',
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    for (const table of TABLES_TO_DROP) {
      await trx.schema.dropTableIfExists(table);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  // Recreate the tables as empty shells. Data is irrecoverable by design.
  // The schemas below mirror src/db/migrations/legacy/001_create_lots_tables.js
  // and 002_create_loyalty_system.js verbatim.
  await knex.transaction(async (trx) => {
    // Recreate lot_categories, lot_tags, lots, lot_photos, lot_participants,
    // lot_tag_assignments, user_preferences, user_favorites IN THE ORIGINAL
    // CREATION ORDER (lot_categories first since lots references it as FK).
    if (!(await trx.schema.hasTable('lot_categories'))) {
      await trx.schema.createTable('lot_categories', (table) => {
        table.increments('id').primary();
        table.string('name', 100).notNullable().unique();
        table.string('description', 500);
        table.string('icon', 50); // emoji or icon identifier
        table.boolean('is_active').defaultTo(true);
        table.timestamps(true, true);
      });
    }

    if (!(await trx.schema.hasTable('lot_tags'))) {
      await trx.schema.createTable('lot_tags', (table) => {
        table.increments('id').primary();
        table.string('name', 100).notNullable().unique();
        table.string('description', 500);
        table.integer('category_id').unsigned().references('id').inTable('lot_categories');
        table.boolean('is_active').defaultTo(true);
        table.timestamps(true, true);
      });
    }

    if (!(await trx.schema.hasTable('lots'))) {
      await trx.schema.createTable('lots', (table) => {
        table.increments('id').primary();
        table.string('title', 255).notNullable();
        table.text('description');
        table.string('author', 255);
        table.decimal('price', 10, 2).notNullable();
        table.string('currency', 3).defaultTo('USD');
        table.string('status', 20).defaultTo('open'); // open, closed, cancelled, completed
        table.bigInteger('created_by').notNullable(); // Telegram user ID
        table.string('chat_id', 50); // Telegram chat ID
        table.string('message_id', 50); // Telegram message ID
        table.string('additional_message_id', 50); // For media groups
        table.jsonb('metadata').defaultTo('{}'); // Additional flexible data
        table.timestamps(true, true);
      });
    }

    if (!(await trx.schema.hasTable('lot_photos'))) {
      await trx.schema.createTable('lot_photos', (table) => {
        table.increments('id').primary();
        table
          .integer('lot_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('lots')
          .onDelete('CASCADE');
        table.string('file_id', 255).notNullable(); // Telegram file ID
        table.integer('order_index').notNullable().defaultTo(0);
        table.timestamps(true, true);
      });
    }

    if (!(await trx.schema.hasTable('lot_participants'))) {
      await trx.schema.createTable('lot_participants', (table) => {
        table
          .integer('lot_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('lots')
          .onDelete('CASCADE');
        table.bigInteger('user_id').notNullable(); // Telegram user ID
        table.string('username', 100);
        table.string('first_name', 100);
        table.string('last_name', 100);
        table.timestamp('joined_at').defaultTo(knex.fn.now());
        table.primary(['lot_id', 'user_id']);
      });
    }

    if (!(await trx.schema.hasTable('lot_tag_assignments'))) {
      await trx.schema.createTable('lot_tag_assignments', (table) => {
        table
          .integer('lot_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('lots')
          .onDelete('CASCADE');
        table
          .integer('tag_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('lot_tags')
          .onDelete('CASCADE');
        table.primary(['lot_id', 'tag_id']);
      });
    }

    if (!(await trx.schema.hasTable('user_preferences'))) {
      await trx.schema.createTable('user_preferences', (table) => {
        table.bigInteger('user_id').primary(); // Telegram user ID
        table.jsonb('favorite_categories').defaultTo('[]'); // Array of category IDs
        table.jsonb('favorite_tags').defaultTo('[]'); // Array of tag IDs
        table
          .jsonb('notification_settings')
          .defaultTo('{"new_lots": true, "price_alerts": true, "category_updates": true}');
        table.string('preferred_currency', 3).defaultTo('USD');
        table.decimal('max_price_preference', 10, 2); // User's max price preference
        table.timestamps(true, true);
      });
    }

    if (!(await trx.schema.hasTable('user_favorites'))) {
      await trx.schema.createTable('user_favorites', (table) => {
        table.bigInteger('user_id').notNullable(); // Telegram user ID
        table
          .integer('lot_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('lots')
          .onDelete('CASCADE');
        table.timestamp('favorited_at').defaultTo(knex.fn.now());
        table.primary(['user_id', 'lot_id']);
      });
    }

    if (!(await trx.schema.hasTable('userLoyalty'))) {
      await trx.schema.createTable('userLoyalty', (table) => {
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
    }
  });
}

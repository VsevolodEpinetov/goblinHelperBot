/**
 * Migration: Fix kickstarters table structure
 * 
 * Ensures the kickstarters table has proper auto-incrementing ID column
 * This fixes the issue where inserts fail due to null ID constraint
 */

exports.up = async function(knex) {
  // Try to fix the kickstarters table ID column
  // Use DO block with exception handling to prevent transaction abort
  await knex.raw(`
    DO $$
    BEGIN
      -- Create sequence if it doesn't exist
      IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'kickstarters_id_seq') THEN
        CREATE SEQUENCE kickstarters_id_seq;
      END IF;
      
      -- Set sequence value to max(id) + 1 if table has data
      PERFORM setval('kickstarters_id_seq', COALESCE((SELECT MAX(id) FROM kickstarters), 0) + 1, false);
      
      -- Set the column default to use the sequence
      ALTER TABLE kickstarters 
      ALTER COLUMN id SET DEFAULT nextval('kickstarters_id_seq');
      
      -- Make sure the sequence is owned by the column
      ALTER SEQUENCE kickstarters_id_seq OWNED BY kickstarters.id;
    EXCEPTION
      WHEN OTHERS THEN
        -- If anything fails, just log and continue
        -- The code in helpers.js has a fallback method
        RAISE NOTICE 'Could not set up auto-increment for kickstarters.id: %', SQLERRM;
    END $$;
  `);
  
  // Ensure related tables exist (these are safe to run even if they exist)
  if (!(await knex.schema.hasTable('kickstarterPhotos'))) {
    await knex.schema.createTable('kickstarterPhotos', (table) => {
      table.increments('id').primary();
      table.integer('kickstarterId').notNullable().references('id').inTable('kickstarters').onDelete('CASCADE');
      table.integer('ord').notNullable();
      table.string('fileId', 255).notNullable();
      table.timestamps(true, true);
      
      table.index(['kickstarterId', 'ord']);
    });
  }
  
  if (!(await knex.schema.hasTable('kickstarterFiles'))) {
    await knex.schema.createTable('kickstarterFiles', (table) => {
      table.increments('id').primary();
      table.integer('kickstarterId').notNullable().references('id').inTable('kickstarters').onDelete('CASCADE');
      table.integer('ord').notNullable();
      table.string('fileId', 255).notNullable();
      table.timestamps(true, true);
      
      table.index(['kickstarterId', 'ord']);
    });
  }
};

exports.down = async function(knex) {
  // Don't drop tables in down migration - they might have data
  // This migration is safe to run multiple times
};


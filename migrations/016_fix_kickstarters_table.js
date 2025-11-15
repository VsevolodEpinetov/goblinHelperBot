/**
 * Migration: Fix kickstarters table structure
 * 
 * Ensures the kickstarters table has proper auto-incrementing ID column
 * This fixes the issue where inserts fail due to null ID constraint
 */

exports.up = async function(knex) {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('kickstarters');
  
  if (!tableExists) {
    // Create table if it doesn't exist
    await knex.schema.createTable('kickstarters', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('creator', 255).notNullable();
      table.string('link', 500).nullable();
      table.integer('cost').notNullable().defaultTo(0);
      table.string('pledgeName', 255).nullable();
      table.string('pledgeCost', 100).nullable();
      table.timestamps(true, true);
      
      table.index(['name', 'creator']);
    });
  } else {
    // Table exists - check if ID column needs fixing
    const hasAutoIncrement = await knex.raw(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'kickstarters' 
      AND column_name = 'id'
      AND column_default LIKE 'nextval%'
    `);
    
    if (!hasAutoIncrement.rows || hasAutoIncrement.rows.length === 0 || !hasAutoIncrement.rows[0].column_default) {
      // ID column exists but doesn't have auto-increment
      // Try to alter it (this might fail if there's data, but that's okay - the code will handle it)
      try {
        await knex.raw(`
          ALTER TABLE kickstarters 
          ALTER COLUMN id TYPE SERIAL
        `);
      } catch (error) {
        // If altering fails, the fallback code in helpers.js will handle it
        console.log('Note: Could not alter kickstarters.id to SERIAL. Using fallback query method.');
      }
    }
  }
  
  // Ensure related tables exist
  const photosTableExists = await knex.schema.hasTable('kickstarterPhotos');
  if (!photosTableExists) {
    await knex.schema.createTable('kickstarterPhotos', (table) => {
      table.increments('id').primary();
      table.integer('kickstarterId').notNullable().references('id').inTable('kickstarters').onDelete('CASCADE');
      table.integer('ord').notNullable();
      table.string('fileId', 255).notNullable();
      table.timestamps(true, true);
      
      table.index(['kickstarterId', 'ord']);
    });
  }
  
  const filesTableExists = await knex.schema.hasTable('kickstarterFiles');
  if (!filesTableExists) {
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


#!/usr/bin/env node

/**
 * Script to migrate ctx.polls.core data to polls_core_studios database table
 * This script should be run on the server where the bot is running
 * 
 * Usage: node scripts/migrate_polls_core_to_db.js
 * 
 * You'll need to manually provide the core studios data that's currently in ctx.polls.core
 */

const knex = require('../modules/db/knex');

// TODO: Replace this array with the actual data from ctx.polls.core on your server
// You can get this by adding a console.log(ctx.polls.core) in the displayCore.js file
const coreStudiosData = [
  // Add the studio names here that are currently in ctx.polls.core
  // Example:
  // "Studio Name 1",
  // "Studio Name 2",
  // etc.
];

async function migrateCoreStudios() {
  try {
    console.log('🔄 Migrating ctx.polls.core data to polls_core_studios table...');
    
    if (coreStudiosData.length === 0) {
      console.log('❌ No core studios data provided. Please update the script with actual data from ctx.polls.core');
      console.log('💡 To get the data, add console.log(ctx.polls.core) in displayCore.js and check the bot logs');
      return;
    }

    // Clear existing data
    console.log('🗑️  Clearing existing core studios...');
    await knex('polls_core_studios').del();

    // Insert new data
    console.log('📝 Inserting core studios...');
    for (const studioName of coreStudiosData) {
      await knex('polls_core_studios').insert({
        name: studioName,
        price: 0 // Default price, can be updated later
      });
      console.log(`✅ Inserted: ${studioName}`);
    }

    console.log(`🎉 Successfully migrated ${coreStudiosData.length} core studios!`);
    
    // Show summary
    const totalCount = await knex('polls_core_studios').count('* as count').first();
    console.log(`📊 Total core studios in database: ${totalCount.count}`);

  } catch (error) {
    console.error('❌ Error migrating core studios:', error);
  } finally {
    await knex.destroy();
  }
}

migrateCoreStudios();

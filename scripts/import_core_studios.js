#!/usr/bin/env node

/**
 * Script to import core studios from studios.json into the database
 * Usage: node scripts/import_core_studios.js
 */

const knex = require('../modules/db/knex');
const STUDIOS = require('../studios.json');

async function importCoreStudios() {
  try {
    console.log('🔄 Importing core studios from studios.json...');
    
    // Check if studios already exist
    const existingCount = await knex('polls_core_studios').count('* as count').first();
    if (existingCount.count > 0) {
      console.log(`⚠️  Core studios already exist (${existingCount.count} records). Skipping import.`);
      console.log('💡 To re-import, first run: DELETE FROM polls_core_studios;');
      return;
    }

    // Import each studio
    for (const studio of STUDIOS) {
      await knex('polls_core_studios').insert({
        name: studio.name,
        price: parseInt(studio.price, 10),
        is_active: true
      });
      console.log(`✅ Imported: ${studio.name} ($${studio.price})`);
    }

    console.log(`🎉 Successfully imported ${STUDIOS.length} core studios!`);
    
    // Show summary
    const totalCount = await knex('polls_core_studios').count('* as count').first();
    console.log(`📊 Total core studios in database: ${totalCount.count}`);

  } catch (error) {
    console.error('❌ Error importing core studios:', error);
  } finally {
    await knex.destroy();
  }
}

importCoreStudios();

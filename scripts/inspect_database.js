#!/usr/bin/env node

/**
 * Database inspection script
 * This script shows the complete database structure for analysis
 */

const knex = require('../modules/db/knex');

async function inspectDatabase() {
  try {
    console.log('🔍 Database Inspection Report\n');
    
    // Get all tables
    const tables = await knex.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`📋 Found ${tables.rows.length} tables:\n`);
    
    for (const tableRow of tables.rows) {
      const tableName = tableRow.table_name;
      console.log(`\n📊 Table: ${tableName}`);
      console.log('─'.repeat(50));
      
      try {
        // Get table structure
        const columns = await knex.raw(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns 
          WHERE table_name = ? 
          ORDER BY ordinal_position
        `, [tableName]);
        
        console.log('Columns:');
        columns.rows.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          const defaultValue = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`  • ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultValue}`);
        });
        
        // Get row count
        const countResult = await knex(tableName).count('* as count').first();
        const rowCount = countResult ? countResult.count : 0;
        console.log(`\n  📈 Row count: ${rowCount}`);
        
        // Show sample data (first 3 rows)
        if (rowCount > 0) {
          console.log('\n  📝 Sample data:');
          const sampleData = await knex(tableName).select('*').limit(3);
          sampleData.forEach((row, index) => {
            console.log(`    Row ${index + 1}:`, JSON.stringify(row, null, 2));
          });
        }
        
        // Get indexes
        const indexes = await knex.raw(`
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes 
          WHERE tablename = ?
        `, [tableName]);
        
        if (indexes.rows.length > 0) {
          console.log('\n  🔗 Indexes:');
          indexes.rows.forEach(idx => {
            console.log(`    • ${idx.indexname}: ${idx.indexdef}`);
          });
        }
        
      } catch (error) {
        console.log(`  ❌ Error inspecting table: ${error.message}`);
      }
    }
    
    // Check for foreign keys
    console.log('\n\n🔗 Foreign Key Relationships:');
    console.log('─'.repeat(50));
    
    const foreignKeys = await knex.raw(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    if (foreignKeys.rows.length > 0) {
      foreignKeys.rows.forEach(fk => {
        console.log(`• ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('No foreign key relationships found');
    }
    
    console.log('\n\n✅ Database inspection completed!');
    
  } catch (error) {
    console.error('❌ Error during database inspection:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the inspection
inspectDatabase();

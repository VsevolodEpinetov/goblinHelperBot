#!/usr/bin/env node

/**
 * Check what roles are allowed in the userRoles table
 */

const knex = require('../modules/db/knex');

async function checkRoleEnum() {
  try {
    console.log('🔍 Checking userRoles table structure...\n');
    
    // Check if table exists
    const tableExists = await knex.schema.hasTable('userRoles');
    if (!tableExists) {
      console.log('❌ userRoles table does not exist');
      return;
    }
    
    // Get table structure
    const columns = await knex.raw(`
      SELECT 
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'userRoles' 
      AND column_name = 'role'
    `);
    
    console.log('📋 userRoles.role column structure:');
    columns.rows.forEach(col => {
      console.log(`  • Type: ${col.data_type} (${col.udt_name})`);
      console.log(`  • Nullable: ${col.is_nullable}`);
      console.log(`  • Default: ${col.column_default || 'none'}`);
    });
    
    // If it's an enum, get the allowed values
    if (columns.rows[0]?.udt_name?.includes('enum') || columns.rows[0]?.data_type === 'USER-DEFINED') {
      console.log('\n📝 Getting enum values...');
      
      const enumTypeName = columns.rows[0].udt_name;
      console.log(`🔍 Enum type name: ${enumTypeName}`);
      
      try {
        const enumValues = await knex.raw(`
          SELECT unnest(enum_range(NULL::"${enumTypeName}")) as role_value
        `);
        
        console.log('✅ Allowed role values:');
        if (enumValues.rows.length > 0) {
          enumValues.rows.forEach(row => {
            console.log(`  • ${row.role_value}`);
          });
        } else {
          console.log('  (no values yet)');
        }
      } catch (error) {
        console.log(`❌ Error getting enum values: ${error.message}`);
        
        // Try alternative approach
        console.log('\n🔍 Trying alternative approach...');
        try {
          const enumValues = await knex.raw(`
            SELECT e.enumlabel as role_value
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = ?
            ORDER BY e.enumsortorder
          `, [enumTypeName]);
          
          console.log('✅ Allowed role values:');
          if (enumValues.rows.length > 0) {
            enumValues.rows.forEach(row => {
              console.log(`  • ${row.role_value}`);
            });
          } else {
            console.log('  (no values yet)');
          }
        } catch (error2) {
          console.log(`❌ Alternative approach also failed: ${error2.message}`);
        }
      }
    }
    
    // Show existing roles in the table
    console.log('\n📊 Existing roles in userRoles table:');
    const existingRoles = await knex('userRoles')
      .select('role')
      .distinct()
      .orderBy('role');
    
    if (existingRoles.length > 0) {
      existingRoles.forEach(row => {
        console.log(`  • ${row.role}`);
      });
    } else {
      console.log('  (no roles assigned yet)');
    }
    
    // Show sample data
    console.log('\n📝 Sample userRoles data:');
    const sampleData = await knex('userRoles')
      .select('*')
      .limit(5);
    
    if (sampleData.length > 0) {
      sampleData.forEach((row, index) => {
        console.log(`  Row ${index + 1}: userId=${row.userId}, role=${row.role}`);
      });
    } else {
      console.log('  (no data)');
    }
    
  } catch (error) {
    console.error('❌ Error checking role enum:', error);
  } finally {
    await knex.destroy();
  }
}

checkRoleEnum();

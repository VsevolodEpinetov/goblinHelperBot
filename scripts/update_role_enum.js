#!/usr/bin/env node

/**
 * Update the role enum to include all needed roles
 */

const knex = require('../modules/db/knex');

async function updateRoleEnum() {
  try {
    console.log('🔧 Updating role enum...\n');
    
    // First, get the enum type name
    const columns = await knex.raw(`
      SELECT udt_name
      FROM information_schema.columns 
      WHERE table_name = 'userRoles' 
      AND column_name = 'role'
    `);
    
    if (columns.rows.length === 0) {
      console.log('❌ userRoles table or role column not found');
      return;
    }
    
    const enumTypeName = columns.rows[0].udt_name;
    console.log(`🔍 Found enum type: ${enumTypeName}\n`);
    
    // Get current enum values
    let currentEnumValues;
    try {
      currentEnumValues = await knex.raw(`
        SELECT unnest(enum_range(NULL::${enumTypeName})) as role_value
      `);
    } catch (error) {
      console.log(`❌ Error getting enum values: ${error.message}`);
      console.log('🔍 Trying alternative approach...');
      
      currentEnumValues = await knex.raw(`
        SELECT e.enumlabel as role_value
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = ?
        ORDER BY e.enumsortorder
      `, [enumTypeName]);
    }
    
    console.log('📋 Current enum values:');
    currentEnumValues.rows.forEach(row => {
      console.log(`  • ${row.role_value}`);
    });
    
    // Define the roles we need
    const neededRoles = ['user', 'goblin', 'polls', 'admin', 'adminPlus', 'super', 'rejected', 'banned'];
    
    console.log('\n📝 Roles we need:');
    neededRoles.forEach(role => {
      console.log(`  • ${role}`);
    });
    
    // Find missing roles
    const currentRoles = currentEnumValues.rows.map(row => row.role_value);
    const missingRoles = neededRoles.filter(role => !currentRoles.includes(role));
    
    if (missingRoles.length === 0) {
      console.log('\n✅ All needed roles are already in the enum!');
      return;
    }
    
    console.log(`\n➕ Missing roles: ${missingRoles.join(', ')}`);
    
    // Add missing roles to enum
    for (const role of missingRoles) {
      try {
        console.log(`\n🔧 Adding role '${role}' to enum...`);
        await knex.raw(`ALTER TYPE ${enumTypeName} ADD VALUE '${role}'`);
        console.log(`✅ Successfully added '${role}'`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Role '${role}' already exists`);
        } else {
          console.error(`❌ Error adding '${role}':`, error.message);
        }
      }
    }
    
    // Show final enum values
    console.log('\n📋 Final enum values:');
    const finalEnumValues = await knex.raw(`
      SELECT unnest(enum_range(NULL::${enumTypeName})) as role_value
    `);
    
    finalEnumValues.rows.forEach(row => {
      console.log(`  • ${row.role_value}`);
    });
    
    console.log('\n✅ Role enum update completed!');
    
  } catch (error) {
    console.error('❌ Error updating role enum:', error);
  } finally {
    await knex.destroy();
  }
}

updateRoleEnum();

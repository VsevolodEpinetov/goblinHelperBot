#!/usr/bin/env node

/**
 * Update the role enum to include all needed roles
 */

const knex = require('../modules/db/knex');

async function updateRoleEnum() {
  try {
    console.log('🔧 Updating role enum...\n');
    
    // First, let's see what we currently have
    const currentEnumValues = await knex.raw(`
      SELECT unnest(enum_range(NULL::userRole)) as role_value
    `);
    
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
        await knex.raw(`ALTER TYPE userRole ADD VALUE '${role}'`);
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
      SELECT unnest(enum_range(NULL::userRole)) as role_value
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

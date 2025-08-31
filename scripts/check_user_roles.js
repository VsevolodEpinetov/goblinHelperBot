#!/usr/bin/env node

/**
 * Check user roles
 * Usage: node scripts/check_user_roles.js <userId>
 */

const knex = require('../modules/db/knex');

async function checkUserRoles() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('❌ Usage: node scripts/check_user_roles.js <userId>');
    console.log('📝 Example: node scripts/check_user_roles.js 91430770');
    process.exit(1);
  }
  
  try {
    console.log(`🔍 Checking roles for user ${userId}...\n`);
    
    // Check if user exists
    const user = await knex('users').where('id', userId).first();
    if (!user) {
      console.log(`❌ User ${userId} not found in users table`);
      console.log('💡 Make sure the user has used /start at least once');
      process.exit(1);
    }
    
    console.log(`👤 User: ${user.firstName || 'Unknown'} ${user.lastName || ''}`);
    console.log(`🆔 ID: ${user.id}`);
    console.log(`👤 Username: @${user.username || 'not_set'}\n`);
    
    // Get user roles
    const roles = await knex('userRoles').where('userId', userId).select('role');
    
    if (roles.length === 0) {
      console.log('❌ No roles assigned to this user');
      console.log('💡 Use: node scripts/add_admin_role.js <userId> <role> to add roles');
    } else {
      console.log('📋 Assigned roles:');
      roles.forEach(role => {
        console.log(`  • ${role.role}`);
      });
    }
    
    // Check if userRoles table exists
    const tableExists = await knex.schema.hasTable('userRoles');
    if (!tableExists) {
      console.log('\n⚠️  userRoles table does not exist!');
      console.log('💡 Run: npm run setup:rbac to create it');
    }
    
  } catch (error) {
    console.error('❌ Error checking roles:', error);
  } finally {
    await knex.destroy();
  }
}

checkUserRoles();

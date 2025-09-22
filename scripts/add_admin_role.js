#!/usr/bin/env node

/**
 * Quick script to add admin roles to users
 * Usage: node scripts/add_admin_role.js <userId> <role>
 * Example: node scripts/add_admin_role.js 91430770 super
 */

const knex = require('../modules/db/knex');

async function addAdminRole() {
  const userId = process.argv[2];
  const role = process.argv[3] || 'admin';
  
  if (!userId) {
    console.log('❌ Usage: node scripts/add_admin_role.js <userId> [role]');
    console.log('📝 Example: node scripts/add_admin_role.js 91430770 super');
    console.log('\nAvailable roles: user, goblin, polls, adminPolls, admin, adminPlus, super');
    process.exit(1);
  }
  
  const validRoles = ['user', 'goblin', 'polls', 'adminPolls', 'admin', 'adminPlus', 'super'];
  if (!validRoles.includes(role)) {
    console.log(`❌ Invalid role: ${role}`);
    console.log(`Valid roles: ${validRoles.join(', ')}`);
    process.exit(1);
  }
  
  try {
    console.log(`🔐 Adding role '${role}' to user ${userId}...`);
    
    // Check if user exists
    const user = await knex('users').where('id', userId).first();
    if (!user) {
      console.log(`❌ User ${userId} not found in users table`);
      console.log('💡 Make sure the user has used /start at least once');
      process.exit(1);
    }
    
    // Add the role
    await knex('userRoles').insert({ 
      userId: Number(userId), 
      role: role 
    }).onConflict(['userId', 'role']).ignore();
    
    console.log(`✅ Successfully added role '${role}' to user ${userId}`);
    
    // Show current roles
    const roles = await knex('userRoles').where('userId', userId).select('role');
    console.log(`📋 Current roles for user ${userId}: ${roles.map(r => r.role).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error adding role:', error);
  } finally {
    await knex.destroy();
  }
}

addAdminRole();

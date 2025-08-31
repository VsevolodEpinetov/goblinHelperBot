#!/usr/bin/env node

/**
 * List recent users to help find user IDs
 */

const knex = require('../modules/db/knex');

async function listRecentUsers() {
  try {
    console.log('👥 Recent users in the system:\n');
    
    // Get recent users (last 10)
    const users = await knex('users')
      .select('id', 'firstName', 'lastName', 'username')
      .orderBy('id', 'desc')
      .limit(10);
    
    if (users.length === 0) {
      console.log('❌ No users found in the system');
      console.log('💡 Make sure users have used /start at least once');
      return;
    }
    
    users.forEach((user, index) => {
      const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();
      const username = user.username ? `@${user.username}` : 'no username';
      console.log(`${index + 1}. ID: ${user.id} | Name: ${name} | Username: ${username}`);
    });
    
    console.log('\n💡 Use: node scripts/add_admin_role.js <userId> <role> to add roles');
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
  } finally {
    await knex.destroy();
  }
}

listRecentUsers();

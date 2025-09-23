#!/usr/bin/env node

/**
 * Simple script to get user IDs of users in groups without goblin role
 * Outputs just the user IDs for easy copying
 */

const knex = require('../modules/db/knex');

async function getSimpleUserList() {
  try {
    console.log('🔍 Finding user IDs of users in groups without goblin role...\n');
    
    // Get just the user IDs
    const userIds = await knex('users')
      .select('users.id')
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .whereNotNull('userGroups.userId')
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id')
      .orderBy('users.id');

    if (userIds.length === 0) {
      console.log('✅ All users with group memberships have the goblin role!');
      return;
    }

    console.log(`📊 Found ${userIds.length} users without goblin role:\n`);
    
    // Output in different formats for easy use
    console.log('📋 User IDs (one per line):');
    userIds.forEach(user => {
      console.log(user.id);
    });
    
    console.log('\n📋 User IDs (comma-separated):');
    console.log(userIds.map(u => u.id).join(', '));
    
    console.log('\n📋 User IDs (array format):');
    console.log(`[${userIds.map(u => u.id).join(', ')}]`);
    
    console.log('\n🔧 SQL INSERT statements:');
    userIds.forEach(user => {
      console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;`);
    });

  } catch (error) {
    console.error('❌ Error getting user list:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the script
getSimpleUserList();

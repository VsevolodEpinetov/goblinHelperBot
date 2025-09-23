#!/usr/bin/env node

/**
 * Find users who are in the main group but don't have the 'goblin' role
 * This script identifies users who should have the goblin role but don't
 */

const knex = require('../modules/db/knex');

async function findUsersWithoutGoblinRole() {
  try {
    console.log('🔍 Finding users in main group without goblin role...\n');
    
    // Query to find users who:
    // 1. Are in the users table
    // 2. Have group memberships (regular or plus groups)
    // 3. Do NOT have the 'goblin' role
    const usersWithoutGoblinRole = await knex('users')
      .select(
        'users.id',
        'users.username',
        'users.firstName',
        'users.lastName',
        knex.raw('ARRAY_AGG(DISTINCT userGroups.type) as group_types'),
        knex.raw('ARRAY_AGG(DISTINCT userGroups.period) as group_periods'),
        knex.raw('ARRAY_AGG(DISTINCT userRoles.role) as current_roles')
      )
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .whereNotNull('userGroups.userId') // Must have group memberships
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .orderBy('users.id');

    if (usersWithoutGoblinRole.length === 0) {
      console.log('✅ All users with group memberships have the goblin role!');
      return;
    }

    console.log(`📊 Found ${usersWithoutGoblinRole.length} users in groups without goblin role:\n`);
    
    // Display results in a nice format
    usersWithoutGoblinRole.forEach((user, index) => {
      const username = user.username || 'not_set';
      const firstName = user.firstName || 'not_set';
      const lastName = user.lastName || '';
      const displayName = `${firstName} ${lastName}`.trim() || username;
      
      console.log(`${index + 1}. User ID: ${user.id}`);
      console.log(`   Name: ${displayName}`);
      console.log(`   Username: @${username}`);
      console.log(`   Group Types: ${user.group_types.filter(t => t).join(', ')}`);
      console.log(`   Group Periods: ${user.group_periods.filter(p => p).join(', ')}`);
      console.log(`   Current Roles: ${user.current_roles.filter(r => r).join(', ') || 'none'}`);
      console.log('');
    });

    // Summary statistics
    const regularGroupUsers = usersWithoutGoblinRole.filter(u => u.group_types.includes('regular')).length;
    const plusGroupUsers = usersWithoutGoblinRole.filter(u => u.group_types.includes('plus')).length;
    
    console.log('📈 Summary:');
    console.log(`   • Users in regular groups: ${regularGroupUsers}`);
    console.log(`   • Users in plus groups: ${plusGroupUsers}`);
    console.log(`   • Total users missing goblin role: ${usersWithoutGoblinRole.length}`);

    // Optional: Generate SQL to add goblin role to these users
    console.log('\n🔧 SQL to add goblin role to these users:');
    console.log('```sql');
    usersWithoutGoblinRole.forEach(user => {
      console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;`);
    });
    console.log('```');

  } catch (error) {
    console.error('❌ Error finding users without goblin role:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the script
findUsersWithoutGoblinRole();

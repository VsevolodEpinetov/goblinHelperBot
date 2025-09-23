#!/usr/bin/env node

/**
 * Detailed analysis of users in groups without goblin role
 * Shows comprehensive information about users and their memberships
 */

const knex = require('../modules/db/knex');

async function detailedUsersAnalysis() {
  try {
    console.log('🔍 Detailed analysis of users in groups without goblin role...\n');
    
    // First, let's get some basic statistics
    const totalUsers = await knex('users').count('* as count').first();
    const totalUsersWithGroups = await knex('userGroups').countDistinct('userId as count').first();
    const totalUsersWithGoblinRole = await knex('userRoles').where('role', 'goblin').count('* as count').first();
    
    console.log('📊 Database Statistics:');
    console.log(`   • Total users: ${totalUsers.count}`);
    console.log(`   • Users with group memberships: ${totalUsersWithGroups.count}`);
    console.log(`   • Users with goblin role: ${totalUsersWithGoblinRole.count}`);
    console.log('');

    // Get detailed information about users without goblin role
    const detailedUsers = await knex('users')
      .select(
        'users.id',
        'users.username',
        'users.firstName',
        'users.lastName',
        knex.raw('ARRAY_AGG(DISTINCT userGroups.type ORDER BY userGroups.type) as group_types'),
        knex.raw('ARRAY_AGG(DISTINCT userGroups.period ORDER BY userGroups.period) as group_periods'),
        knex.raw('ARRAY_AGG(DISTINCT userRoles.role ORDER BY userRoles.role) as current_roles'),
        knex.raw('COUNT(DISTINCT userGroups.period) as total_periods'),
        knex.raw('MAX(userGroups.period) as latest_period')
      )
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .whereNotNull('userGroups.userId')
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .orderBy('total_periods', 'desc')
      .orderBy('users.id');

    if (detailedUsers.length === 0) {
      console.log('✅ All users with group memberships have the goblin role!');
      return;
    }

    console.log(`📋 Found ${detailedUsers.length} users in groups without goblin role:\n`);
    
    // Group users by their current roles for better analysis
    const usersByRole = {};
    detailedUsers.forEach(user => {
      const roles = user.current_roles.filter(r => r);
      const roleKey = roles.length > 0 ? roles.join(', ') : 'no_roles';
      if (!usersByRole[roleKey]) {
        usersByRole[roleKey] = [];
      }
      usersByRole[roleKey].push(user);
    });

    // Display users grouped by their current roles
    Object.keys(usersByRole).forEach(roleGroup => {
      const users = usersByRole[roleGroup];
      console.log(`\n🔸 Users with roles: ${roleGroup} (${users.length} users)`);
      console.log('─'.repeat(80));
      
      users.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        console.log(`${index + 1}. ID: ${user.id} | @${username} | ${displayName}`);
        console.log(`   Groups: ${user.group_types.join(', ')} | Periods: ${user.total_periods} | Latest: ${user.latest_period}`);
        console.log('');
      });
    });

    // Additional analysis
    const regularOnlyUsers = detailedUsers.filter(u => u.group_types.includes('regular') && !u.group_types.includes('plus'));
    const plusUsers = detailedUsers.filter(u => u.group_types.includes('plus'));
    const usersWithManyPeriods = detailedUsers.filter(u => u.total_periods >= 3);
    
    console.log('\n📈 Detailed Analysis:');
    console.log(`   • Users in regular groups only: ${regularOnlyUsers.length}`);
    console.log(`   • Users in plus groups: ${plusUsers.length}`);
    console.log(`   • Users with 3+ group periods: ${usersWithManyPeriods.length}`);
    
    // Show users with most group periods (likely most active)
    if (usersWithManyPeriods.length > 0) {
      console.log('\n🏆 Users with most group periods (likely need goblin role most urgently):');
      usersWithManyPeriods.slice(0, 10).forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const displayName = `${firstName}`.trim() || username;
        console.log(`   ${index + 1}. ${displayName} (@${username}) - ${user.total_periods} periods`);
      });
    }

    // Generate batch SQL for adding goblin roles
    console.log('\n🔧 Batch SQL to add goblin role:');
    console.log('```sql');
    console.log('-- Add goblin role to all users in groups without it');
    detailedUsers.forEach(user => {
      console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;`);
    });
    console.log('```');

  } catch (error) {
    console.error('❌ Error in detailed analysis:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the script
detailedUsersAnalysis();

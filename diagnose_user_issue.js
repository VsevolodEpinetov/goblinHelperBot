#!/usr/bin/env node

/**
 * Diagnostic script to check why users with goblin roles are being sent to registration
 * This will help identify the root cause of the authentication issue
 */

const knex = require('./modules/db/knex');
const { getUser } = require('./modules/db/helpers');

// Test with a known user from the export who should have goblin role
const TEST_USER_IDS = [
  '1292914182', // Komrad13sq - high spender
  '440173485',  // Volodja23 - high spender
  '1427093277', // EvgenMol - high spender
  '91430770'    // send_dog_pics - appears to be admin
];

async function diagnoseUserIssue() {
  console.log('🔍 Diagnosing user authentication issue...\n');
  
  try {
    // 1. Check if database connection works
    console.log('📡 Testing database connection...');
    const connectionTest = await knex.raw('SELECT NOW()');
    console.log('✅ Database connection successful:', connectionTest.rows[0].now);
    
    // 2. Check if required tables exist
    console.log('\n📋 Checking required tables...');
    const tables = ['users', 'userRoles', 'userGroups', 'userPurchases'];
    for (const table of tables) {
      const exists = await knex.schema.hasTable(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}: ${exists ? 'exists' : 'MISSING'}`);
    }
    
    // 3. Check table counts
    console.log('\n📊 Table row counts:');
    for (const table of tables) {
      try {
        const count = await knex(table).count('* as count').first();
        console.log(`  • ${table}: ${count.count} rows`);
      } catch (error) {
        console.log(`  ❌ ${table}: Error - ${error.message}`);
      }
    }
    
    // 4. Test specific users from the export
    console.log('\n👥 Testing specific users from export...');
    for (const userId of TEST_USER_IDS) {
      console.log(`\n🔍 Testing user ${userId}:`);
      
      // Check if user exists in users table
      const userRecord = await knex('users').where('id', userId).first();
      console.log(`  Users table: ${userRecord ? '✅ Found' : '❌ Not found'}`);
      if (userRecord) {
        console.log(`    - Username: ${userRecord.username || 'not_set'}`);
        console.log(`    - Name: ${userRecord.firstName || 'Unknown'} ${userRecord.lastName || ''}`);
      }
      
      // Check roles
      const roles = await knex('userRoles').where('userId', userId).select('role');
      console.log(`  Roles: ${roles.length > 0 ? roles.map(r => r.role).join(', ') : '❌ No roles found'}`);
      
      // Check groups (purchased months)
      const groups = await knex('userGroups').where('userId', userId).select('period', 'type');
      console.log(`  Groups: ${groups.length > 0 ? `${groups.length} months` : '❌ No groups found'}`);
      
      // Test getUser helper function
      const userData = await getUser(userId);
      console.log(`  getUser() result: ${userData ? '✅ Success' : '❌ Returns null'}`);
      if (userData) {
        console.log(`    - Roles: [${userData.roles.join(', ')}]`);
        console.log(`    - Regular months: ${userData.purchases.groups.regular.length}`);
        console.log(`    - Plus months: ${userData.purchases.groups.plus.length}`);
      }
    }
    
    // 5. Check for data inconsistencies
    console.log('\n🔍 Checking for data inconsistencies...');
    
    // Users without roles
    const usersWithoutRoles = await knex('users')
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .whereNull('userRoles.userId')
      .select('users.id', 'users.username', 'users.firstName');
    
    console.log(`  Users without roles: ${usersWithoutRoles.length}`);
    if (usersWithoutRoles.length > 0 && usersWithoutRoles.length <= 10) {
      usersWithoutRoles.forEach(user => {
        console.log(`    - ${user.id} (@${user.username || 'no_username'}) ${user.firstName || 'Unknown'}`);
      });
    }
    
    // Roles without users
    const rolesWithoutUsers = await knex('userRoles')
      .leftJoin('users', 'userRoles.userId', 'users.id')
      .whereNull('users.id')
      .select('userRoles.userId', 'userRoles.role');
    
    console.log(`  Roles without users: ${rolesWithoutUsers.length}`);
    if (rolesWithoutUsers.length > 0 && rolesWithoutUsers.length <= 10) {
      rolesWithoutUsers.forEach(role => {
        console.log(`    - User ${role.userId} has role '${role.role}' but no user record`);
      });
    }
    
    // 6. Check role distribution
    console.log('\n📈 Role distribution:');
    const roleStats = await knex('userRoles')
      .select('role')
      .count('* as count')
      .groupBy('role')
      .orderBy('count', 'desc');
    
    roleStats.forEach(stat => {
      console.log(`  • ${stat.role}: ${stat.count} users`);
    });
    
    // 7. Sample a few users who should have goblin role
    console.log('\n🎯 Users who should have goblin role (from export):');
    const sampleUserIds = ['1292914182', '440173485', '1427093277', '495764441', '463332905'];
    for (const userId of sampleUserIds) {
      const roles = await knex('userRoles').where('userId', userId).select('role');
      const groups = await knex('userGroups').where('userId', userId).count('* as count').first();
      console.log(`  • ${userId}: roles=[${roles.map(r => r.role).join(', ')}] groups=${groups.count}`);
    }
    
    console.log('\n✅ Diagnosis completed!');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await knex.destroy();
  }
}

// Run diagnosis
diagnoseUserIssue();

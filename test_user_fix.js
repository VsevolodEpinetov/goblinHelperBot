#!/usr/bin/env node

/**
 * Test User Fix Script
 * 
 * This script tests the user authentication fix by:
 * 1. Checking a specific user's data
 * 2. Adding goblin role if missing
 * 3. Testing the getUser function
 */

const knex = require('./modules/db/knex');
const { getUser } = require('./modules/db/helpers');

// Test with a known user from the export
const TEST_USER_ID = '1292914182'; // Komrad13sq - high spender from export

async function testUserFix() {
  console.log('🧪 Testing user authentication fix...\n');
  
  try {
    console.log(`🔍 Testing user ${TEST_USER_ID}:`);
    
    // 1. Check if user exists in database
    const userRecord = await knex('users').where('id', TEST_USER_ID).first();
    console.log(`  Database record: ${userRecord ? '✅ Found' : '❌ Missing'}`);
    
    if (!userRecord) {
      console.log('  ❌ User not found in database. Need to import user data first.');
      return;
    }
    
    console.log(`    - Username: @${userRecord.username || 'not_set'}`);
    console.log(`    - Name: ${userRecord.firstName || 'Unknown'} ${userRecord.lastName || ''}`);
    
    // 2. Check current roles
    const currentRoles = await knex('userRoles').where('userId', TEST_USER_ID).select('role');
    console.log(`  Current roles: [${currentRoles.map(r => r.role).join(', ')}]`);
    
    // 3. Check if user has purchase history (should qualify for goblin role)
    const groups = await knex('userGroups').where('userId', TEST_USER_ID).count('* as count').first();
    const kickstarters = await knex('userKickstarters').where('userId', TEST_USER_ID).count('* as count').first();
    
    console.log(`  Purchase history:`);
    console.log(`    - Months purchased: ${groups.count}`);
    console.log(`    - Kickstarters: ${kickstarters.count}`);
    
    const shouldHaveGoblinRole = groups.count > 0 || kickstarters.count > 0;
    console.log(`  Should have goblin role: ${shouldHaveGoblinRole ? '✅ Yes' : '❌ No'}`);
    
    // 4. Test getUser function BEFORE fix
    console.log('\n🔍 Testing getUser() function BEFORE fix:');
    const userDataBefore = await getUser(TEST_USER_ID);
    console.log(`  getUser() result: ${userDataBefore ? '✅ Success' : '❌ Returns null'}`);
    
    if (userDataBefore) {
      console.log(`    - Roles: [${userDataBefore.roles.join(', ')}]`);
      console.log(`    - Has goblin role: ${userDataBefore.roles.includes('goblin') ? '✅ Yes' : '❌ No'}`);
    }
    
    // 5. Add goblin role if missing and user qualifies
    if (shouldHaveGoblinRole && !currentRoles.some(r => r.role === 'goblin')) {
      console.log('\n🔧 Adding missing goblin role...');
      
      await knex('userRoles').insert({
        userId: parseInt(TEST_USER_ID),
        role: 'goblin'
      }).onConflict(['userId', 'role']).ignore();
      
      console.log('  ✅ Goblin role added');
    }
    
    // 6. Test getUser function AFTER fix
    console.log('\n🔍 Testing getUser() function AFTER fix:');
    const userDataAfter = await getUser(TEST_USER_ID);
    console.log(`  getUser() result: ${userDataAfter ? '✅ Success' : '❌ Returns null'}`);
    
    if (userDataAfter) {
      console.log(`    - Roles: [${userDataAfter.roles.join(', ')}]`);
      console.log(`    - Has goblin role: ${userDataAfter.roles.includes('goblin') ? '✅ Yes' : '❌ No'}`);
      console.log(`    - Regular months: ${userDataAfter.purchases.groups.regular.length}`);
      console.log(`    - Plus months: ${userDataAfter.purchases.groups.plus.length}`);
    }
    
    // 7. Test menu system logic
    console.log('\n🎭 Testing menu system logic:');
    if (userDataAfter && userDataAfter.roles.length > 0) {
      const roles = userDataAfter.roles;
      
      if (roles.includes('super')) {
        console.log('  🎭 User would get: Super admin menu');
      } else if (roles.includes('goblin') || roles.includes('admin') || roles.includes('adminPlus')) {
        console.log('  🎭 User would get: Approved user menu (with invitation link)');
      } else if (roles.includes('pending')) {
        console.log('  🎭 User would get: Pending user menu');
      } else if (roles.includes('rejected')) {
        console.log('  🎭 User would get: Rejected user menu');
      } else {
        console.log('  🎭 User would get: New user menu (registration)');
      }
    } else {
      console.log('  🎭 User would get: New user menu (registration)');
    }
    
    console.log('\n✅ Test completed!');
    
    if (userDataAfter && userDataAfter.roles.includes('goblin')) {
      console.log('🎉 SUCCESS: User should now be recognized by the bot!');
    } else {
      console.log('❌ ISSUE: User still might not be recognized properly');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await knex.destroy();
  }
}

// Run test
testUserFix();

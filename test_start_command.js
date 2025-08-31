#!/usr/bin/env node

/**
 * Test script to verify the start command functionality
 */

const { getUser } = require('./modules/db/helpers');
const util = require('./modules/util');
const SETTINGS = require('./settings.json');

async function testStartCommand() {
  try {
    console.log('🧪 Testing start command functionality...\n');
    
    // Test with your user ID
    const userId = '91430770';
    
    console.log(`📋 Testing for user ID: ${userId}`);
    console.log(`🔍 User ID matches EPINETOV setting: ${userId === SETTINGS.CHATS.EPINETOV}`);
    console.log(`🔍 User ID matches ANN setting: ${userId === SETTINGS.CHATS.ANN}`);
    
    // Get user data
    const userData = await getUser(userId);
    
    if (!userData) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('\n📊 User data:');
    console.log(`  • ID: ${userData.id}`);
    console.log(`  • Username: ${userData.username}`);
    console.log(`  • Name: ${userData.first_name} ${userData.last_name}`);
    console.log(`  • Roles: ${userData.roles.join(', ')}`);
    
    // Test isSuperUser function
    const isSuper = util.isSuperUser(userId);
    console.log(`\n👑 Is super user: ${isSuper}`);
    
    // Test role checks
    const hasGoblinRole = userData.roles.indexOf('goblin') > -1;
    const hasAdminRole = userData.roles.indexOf('admin') > -1;
    const hasAdminPlusRole = userData.roles.indexOf('adminPlus') > -1;
    
    console.log(`\n🔐 Role checks:`);
    console.log(`  • Has goblin role: ${hasGoblinRole}`);
    console.log(`  • Has admin role: ${hasAdminRole}`);
    console.log(`  • Has adminPlus role: ${hasAdminPlusRole}`);
    
    // Simulate start command logic
    console.log('\n🎯 Start command logic simulation:');
    
    if (isSuper) {
      console.log('✅ Would show super admin menu');
    } else if (hasGoblinRole || hasAdminRole || hasAdminPlusRole) {
      console.log('✅ Would show interactive menu for regular users');
    } else if (userData.roles.length === 0) {
      console.log('⚠️  Would show pending message');
    } else if (userData.roles.indexOf('rejected') > -1) {
      console.log('❌ Would show rejected message');
    } else {
      console.log('❓ No matching condition - user might not get a response');
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testStartCommand();

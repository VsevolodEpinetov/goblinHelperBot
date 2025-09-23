#!/usr/bin/env node

/**
 * Simple script to get user IDs of users in main group without goblin role
 * Also includes users who paid for specific months
 * Outputs just the user IDs for easy copying
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const knex = require('../modules/db/knex');
const SETTINGS = require('../settings.json');

// Initialize bot for API calls
const bot = new Telegraf(process.env.TOKEN);

async function getSimpleMainGroupCheck() {
  try {
    console.log('🔍 Checking users in main group without goblin role...\n');
    
    // Get users without goblin role
    const usersWithoutGoblinRole = await knex('users')
      .select('users.id', 'users.username', 'users.firstName')
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .orderBy('users.id');

    console.log(`📊 Found ${usersWithoutGoblinRole.length} users without goblin role in database\n`);

    // Check Telegram group membership
    const usersInMainGroup = [];
    const errors = [];

    console.log('🔍 Checking Telegram group membership...\n');

    for (let i = 0; i < usersWithoutGoblinRole.length; i++) {
      const user = usersWithoutGoblinRole[i];
      const username = user.username || 'not_set';
      const firstName = user.firstName || 'not_set';
      const displayName = `${firstName}`.trim() || username;
      
      process.stdout.write(`Checking ${i + 1}/${usersWithoutGoblinRole.length}: ${displayName}... `);
      
      try {
        const chatMember = await bot.telegram.getChatMember(SETTINGS.CHATS.GOBLIN, user.id);
        const isActiveMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
        
        if (isActiveMember) {
          usersInMainGroup.push(user.id);
          console.log('✅ In group');
        } else {
          console.log(`❌ Not active (${chatMember.status})`);
        }
      } catch (error) {
        errors.push({ id: user.id, error: error.message });
        console.log(`❌ Error: ${error.message}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Also get users who paid for specific months
    console.log('\n🔍 Checking users who paid for 2025_07, 2025_08, 2025_09...\n');
    
    const specificMonths = ['2025_07', '2025_08', '2025_09'];
    const usersWithSpecificPayments = await knex('users')
      .select('users.id')
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .whereIn('userGroups.period', specificMonths)
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id')
      .orderBy('users.id');

    console.log(`📊 Found ${usersWithSpecificPayments.length} users who paid for specific months without goblin role\n`);

    // Combine both lists and remove duplicates
    const allUserIds = [...new Set([...usersInMainGroup, ...usersWithSpecificPayments.map(u => u.id)])];

    console.log(`\n📈 Summary:`);
    console.log(`   • Users in main group without goblin role: ${usersInMainGroup.length}`);
    console.log(`   • Users with specific payments without goblin role: ${usersWithSpecificPayments.length}`);
    console.log(`   • Total unique users: ${allUserIds.length}`);
    console.log(`   • API errors: ${errors.length}`);

    if (allUserIds.length === 0) {
      console.log('\n✅ No users found that need the goblin role!');
      return;
    }

    // Output in different formats
    console.log('\n📋 User IDs (one per line):');
    allUserIds.forEach(id => console.log(id));
    
    console.log('\n📋 User IDs (comma-separated):');
    console.log(allUserIds.join(', '));
    
    console.log('\n📋 User IDs (array format):');
    console.log(`[${allUserIds.join(', ')}]`);
    
    console.log('\n🔧 SQL INSERT statements:');
    allUserIds.forEach(id => {
      console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${id}, 'goblin') ON CONFLICT DO NOTHING;`);
    });

    // Show errors if any
    if (errors.length > 0) {
      console.log('\n⚠️ Users with API errors:');
      errors.forEach((user, index) => {
        console.log(`${index + 1}. User ID ${user.id} - Error: ${user.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await knex.destroy();
    process.exit(0);
  }
}

// Run the script
getSimpleMainGroupCheck();

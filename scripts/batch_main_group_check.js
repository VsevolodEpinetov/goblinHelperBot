#!/usr/bin/env node

/**
 * Batch check for users in main group without goblin role
 * More efficient version with better error handling and batching
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const knex = require('../modules/db/knex');
const SETTINGS = require('../settings.json');

// Initialize bot for API calls
const bot = new Telegraf(process.env.TOKEN);

async function batchMainGroupCheck() {
  try {
    console.log('🔍 Batch checking users in main group without goblin role...\n');
    console.log(`📱 Main group ID: ${SETTINGS.CHATS.GOBLIN}\n`);
    
    // Get users without goblin role
    const usersWithoutGoblinRole = await knex('users')
      .select('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .orderBy('users.id');

    console.log(`📊 Found ${usersWithoutGoblinRole.length} users without goblin role in database\n`);

    // Get users who paid for specific months
    const specificMonths = ['2025_07', '2025_08', '2025_09'];
    const usersWithSpecificPayments = await knex('users')
      .select('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .whereIn('userGroups.period', specificMonths)
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur.userId = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .orderBy('users.id');

    console.log(`📊 Found ${usersWithSpecificPayments.length} users who paid for specific months without goblin role\n`);

    // Combine both lists and remove duplicates
    const allUsers = new Map();
    usersWithoutGoblinRole.forEach(user => allUsers.set(user.id, { ...user, source: 'no_goblin_role' }));
    usersWithSpecificPayments.forEach(user => {
      if (allUsers.has(user.id)) {
        allUsers.get(user.id).source += ', specific_payments';
      } else {
        allUsers.set(user.id, { ...user, source: 'specific_payments' });
      }
    });

    const uniqueUsers = Array.from(allUsers.values());
    console.log(`📊 Total unique users to check: ${uniqueUsers.length}\n`);

    // Check Telegram group membership in batches
    const usersInMainGroup = [];
    const usersNotInMainGroup = [];
    const errors = [];

    console.log('🔍 Checking Telegram group membership in batches...\n');

    const batchSize = 10;
    for (let i = 0; i < uniqueUsers.length; i += batchSize) {
      const batch = uniqueUsers.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUsers.length / batchSize)} (${batch.length} users)...`);
      
      const batchPromises = batch.map(async (user) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const displayName = `${firstName}`.trim() || username;
        
        try {
          const chatMember = await bot.telegram.getChatMember(SETTINGS.CHATS.GOBLIN, user.id);
          const isActiveMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
          
          return {
            user,
            isInMainGroup: isActiveMember,
            status: chatMember.status,
            error: null
          };
        } catch (error) {
          return {
            user,
            isInMainGroup: false,
            status: 'error',
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.error) {
          errors.push({ ...result.user, error: result.error });
        } else if (result.isInMainGroup) {
          usersInMainGroup.push({ ...result.user, telegramStatus: result.status });
        } else {
          usersNotInMainGroup.push({ ...result.user, telegramStatus: result.status });
        }
      });

      // Delay between batches to avoid rate limiting
      if (i + batchSize < uniqueUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n📈 Results Summary:');
    console.log(`   • Users in main group without goblin role: ${usersInMainGroup.length}`);
    console.log(`   • Users not in main group: ${usersNotInMainGroup.length}`);
    console.log(`   • API errors: ${errors.length}`);

    // Display results
    if (usersInMainGroup.length > 0) {
      console.log('\n🎯 Users in main group without goblin role:');
      console.log('─'.repeat(80));
      
      usersInMainGroup.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        console.log(`${index + 1}. ID: ${user.id} | @${username} | ${displayName}`);
        console.log(`   Status: ${user.telegramStatus} | Source: ${user.source}`);
        console.log('');
      });

      // Generate SQL
      console.log('\n🔧 SQL to add goblin role to users in main group:');
      console.log('```sql');
      usersInMainGroup.forEach(user => {
        console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;`);
      });
      console.log('```');

      // Output user IDs for easy copying
      console.log('\n📋 User IDs (comma-separated):');
      console.log(usersInMainGroup.map(u => u.id).join(', '));
    } else {
      console.log('\n✅ No users found in main group without goblin role!');
    }

    // Show errors if any
    if (errors.length > 0) {
      console.log('\n⚠️ Users with API errors:');
      errors.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const displayName = `${firstName}`.trim() || username;
        console.log(`${index + 1}. ${displayName} (@${username}) - Error: ${user.error}`);
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
batchMainGroupCheck();

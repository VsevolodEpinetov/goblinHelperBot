#!/usr/bin/env node

/**
 * Find users who are in the main Telegram group but don't have the 'goblin' role
 * Also includes users who paid for specific months (2025_07, 2025_08, 2025_09)
 * Uses Telegram API to verify actual group membership
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const knex = require('../modules/db/knex');
const SETTINGS = require('../settings.json');
const fs = require('fs');
const path = require('path');

// Initialize bot for API calls
const bot = new Telegraf(process.env.TOKEN);

async function findUsersInMainGroupWithoutGoblinRole() {
  try {
    console.log('🔍 Finding users in main group without goblin role...\n');
    console.log(`📱 Main group ID: ${SETTINGS.CHATS.GOBLIN}\n`);
    
    // Get all users without goblin role
    const usersWithoutGoblinRole = await knex('users')
      .select(
        'users.id',
        'users.username',
        'users.firstName',
        'users.lastName'
      )
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur."userId" = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .orderBy('users.id');

    console.log(`📊 Found ${usersWithoutGoblinRole.length} users without goblin role in database\n`);

    // Check which users are actually in the main group
    const usersInMainGroup = [];
    const usersNotInMainGroup = [];
    const errors = [];

    console.log('🔍 Checking Telegram group membership...\n');

    for (let i = 0; i < usersWithoutGoblinRole.length; i++) {
      const user = usersWithoutGoblinRole[i];
      const username = user.username || 'not_set';
      const firstName = user.firstName || 'not_set';
      const displayName = `${firstName}`.trim() || username;
      
      process.stdout.write(`Checking ${i + 1}/${usersWithoutGoblinRole.length}: ${displayName} (@${username})... `);
      
      try {
        const chatMember = await bot.telegram.getChatMember(SETTINGS.CHATS.GOBLIN, user.id);
        
        // Check if user is an active member (not left, kicked, or restricted)
        const isActiveMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
        
        if (isActiveMember) {
          usersInMainGroup.push({
            ...user,
            telegramStatus: chatMember.status,
            isInMainGroup: true
          });
          console.log('✅ In group');
        } else {
          usersNotInMainGroup.push({
            ...user,
            telegramStatus: chatMember.status,
            isInMainGroup: false
          });
          console.log(`❌ Not active (${chatMember.status})`);
        }
      } catch (error) {
        errors.push({
          ...user,
          error: error.message
        });
        console.log(`❌ Error: ${error.message}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📈 Results Summary:');
    console.log(`   • Users in main group without goblin role: ${usersInMainGroup.length}`);
    console.log(`   • Users not in main group: ${usersNotInMainGroup.length}`);
    console.log(`   • API errors: ${errors.length}`);

    // Debug: Show the actual users found
    if (usersInMainGroup.length > 0) {
      console.log('\n🔍 Debug - Users in main group:');
      usersInMainGroup.forEach((user, index) => {
        console.log(`  ${index + 1}. ID: ${user.id}, Username: ${user.username}, Name: ${user.firstName} ${user.lastName}`);
      });
    }

    // Also check for users who paid for specific months
    console.log('\n🔍 Checking users who paid for 2025_07, 2025_08, 2025_09...\n');
    
    const specificMonths = ['2025_07', '2025_08', '2025_09'];
    const usersWithSpecificPayments = await knex('users')
      .select(
        'users.id',
        'users.username',
        'users.firstName',
        'users.lastName'
      )
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .whereIn('userGroups.period', specificMonths)
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur."userId" = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .groupBy('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .orderBy('users.id');

    console.log(`📊 Found ${usersWithSpecificPayments.length} users who paid for specific months without goblin role\n`);

    // Display users in main group without goblin role
    if (usersInMainGroup.length > 0) {
      console.log('\n🎯 Users in main group without goblin role:');
      console.log('─'.repeat(80));
      
      usersInMainGroup.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        console.log(`${index + 1}. ID: ${user.id} | @${username} | ${displayName}`);
        console.log(`   Status: ${user.telegramStatus}`);
        console.log('');
      });
    } else {
      console.log('\n✅ No users found in main group without goblin role!');
    }

    // Display users who paid for specific months
    if (usersWithSpecificPayments.length > 0) {
      console.log('\n💰 Users who paid for 2025_07, 2025_08, 2025_09 without goblin role:');
      console.log('─'.repeat(80));
      
      usersWithSpecificPayments.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        console.log(`${index + 1}. ID: ${user.id} | @${username} | ${displayName}`);
        console.log('');
      });
    }

    // Generate SQL for users in main group
    if (usersInMainGroup.length > 0) {
      console.log('\n🔧 SQL to add goblin role to users in main group:');
      console.log('```sql');
      usersInMainGroup.forEach(user => {
        console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;`);
      });
      console.log('```');
    }

    // Generate SQL for users with specific payments
    if (usersWithSpecificPayments.length > 0) {
      console.log('\n🔧 SQL to add goblin role to users with specific payments:');
      console.log('```sql');
      usersWithSpecificPayments.forEach(user => {
        console.log(`INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;`);
      });
      console.log('```');
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

    // Generate file output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(__dirname, `users_without_goblin_role_${timestamp}.txt`);
    
    let fileContent = `Users in Main Group Without Goblin Role - ${new Date().toLocaleString()}\n`;
    fileContent += `Main Group ID: ${SETTINGS.CHATS.GOBLIN}\n`;
    fileContent += `Generated at: ${new Date().toISOString()}\n\n`;
    
    fileContent += `SUMMARY:\n`;
    fileContent += `• Users in main group without goblin role: ${usersInMainGroup.length}\n`;
    fileContent += `• Users not in main group: ${usersNotInMainGroup.length}\n`;
    fileContent += `• Users with specific payments without goblin role: ${usersWithSpecificPayments.length}\n`;
    fileContent += `• API errors: ${errors.length}\n\n`;
    
    if (usersInMainGroup.length > 0) {
      fileContent += `USERS IN MAIN GROUP WITHOUT GOBLIN ROLE:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      
      usersInMainGroup.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        fileContent += `${index + 1}. ID: ${user.id} | @${username} | ${displayName}\n`;
        fileContent += `   Status: ${user.telegramStatus}\n\n`;
      });
    }
    
    if (usersWithSpecificPayments.length > 0) {
      fileContent += `USERS WHO PAID FOR 2025_07, 2025_08, 2025_09 WITHOUT GOBLIN ROLE:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      
      usersWithSpecificPayments.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        fileContent += `${index + 1}. ID: ${user.id} | @${username} | ${displayName}\n\n`;
      });
    }
    
    if (errors.length > 0) {
      fileContent += `USERS WITH API ERRORS:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      
      errors.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const displayName = `${firstName}`.trim() || username;
        fileContent += `${index + 1}. ${displayName} (@${username}) - Error: ${user.error}\n`;
      });
    }
    
    // Add SQL statements
    if (usersInMainGroup.length > 0) {
      fileContent += `\n\nSQL TO ADD GOBLIN ROLE TO USERS IN MAIN GROUP:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      usersInMainGroup.forEach(user => {
        fileContent += `INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;\n`;
      });
    }
    
    if (usersWithSpecificPayments.length > 0) {
      fileContent += `\n\nSQL TO ADD GOBLIN ROLE TO USERS WITH SPECIFIC PAYMENTS:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      usersWithSpecificPayments.forEach(user => {
        fileContent += `INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;\n`;
      });
    }
    
    // Write to file
    fs.writeFileSync(outputFile, fileContent, 'utf8');
    console.log(`\n📄 Results saved to: ${outputFile}`);

  } catch (error) {
    console.error('❌ Error finding users:', error);
  } finally {
    await knex.destroy();
    process.exit(0);
  }
}

// Run the script
findUsersInMainGroupWithoutGoblinRole();

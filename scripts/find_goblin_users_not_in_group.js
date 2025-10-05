#!/usr/bin/env node

/**
 * Find users with 'goblin' role who are NOT in the main group
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

async function findGoblinUsersNotInGroup() {
  try {
    console.log('🔍 Finding users with goblin role who are NOT in the main group...\n');
    console.log(`📱 Main group ID: ${SETTINGS.CHATS.GOBLIN}\n`);
    
    // Get all users with goblin role
    const goblinUsers = await knex('users')
      .select(
        'users.id',
        'users.username',
        'users.firstName',
        'users.lastName'
      )
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .where('userRoles.role', 'goblin')
      .groupBy('users.id', 'users.username', 'users.firstName', 'users.lastName')
      .orderBy('users.id');

    console.log(`📊 Found ${goblinUsers.length} users with goblin role in database\n`);

    if (goblinUsers.length === 0) {
      console.log('❌ No users with goblin role found in database!');
      return;
    }

    // Check which users are NOT in the main group
    const usersNotInGroup = [];
    const usersInGroup = [];
    const errors = [];

    console.log('🔍 Checking Telegram group membership...\n');

    for (let i = 0; i < goblinUsers.length; i++) {
      const user = goblinUsers[i];
      const username = user.username || 'not_set';
      const firstName = user.firstName || 'not_set';
      const displayName = `${firstName}`.trim() || username;
      
      process.stdout.write(`Checking ${i + 1}/${goblinUsers.length}: ${displayName} (@${username})... `);
      
      try {
        const chatMember = await bot.telegram.getChatMember(SETTINGS.CHATS.GOBLIN, user.id);
        
        // Check if user is an active member (not left, kicked, or restricted)
        const isActiveMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
        
        if (isActiveMember) {
          usersInGroup.push({
            ...user,
            telegramStatus: chatMember.status,
            isInMainGroup: true
          });
          console.log('✅ In group');
        } else {
          usersNotInGroup.push({
            ...user,
            telegramStatus: chatMember.status,
            isInMainGroup: false
          });
          console.log(`❌ Not in group (${chatMember.status})`);
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
    console.log(`   • Users with goblin role NOT in main group: ${usersNotInGroup.length}`);
    console.log(`   • Users with goblin role IN main group: ${usersInGroup.length}`);
    console.log(`   • API errors: ${errors.length}`);

    // Display users NOT in group
    if (usersNotInGroup.length > 0) {
      console.log('\n🎯 Users with goblin role NOT in main group:');
      console.log('─'.repeat(80));
      
      usersNotInGroup.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        console.log(`${index + 1}. ID: ${user.id} | @${username} | ${displayName}`);
        console.log(`   Status: ${user.telegramStatus}`);
        console.log('');
      });
    } else {
      console.log('\n✅ All users with goblin role are in the main group!');
    }

    // Generate file output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(__dirname, `goblin_users_not_in_group_${timestamp}.txt`);
    
    let fileContent = `Users with Goblin Role NOT in Main Group - ${new Date().toLocaleString()}\n`;
    fileContent += `Main Group ID: ${SETTINGS.CHATS.GOBLIN}\n`;
    fileContent += `Generated at: ${new Date().toISOString()}\n\n`;
    
    fileContent += `SUMMARY:\n`;
    fileContent += `• Total users with goblin role: ${goblinUsers.length}\n`;
    fileContent += `• Users with goblin role NOT in main group: ${usersNotInGroup.length}\n`;
    fileContent += `• Users with goblin role IN main group: ${usersInGroup.length}\n`;
    fileContent += `• API errors: ${errors.length}\n\n`;
    
    if (usersNotInGroup.length > 0) {
      fileContent += `USERS WITH GOBLIN ROLE NOT IN MAIN GROUP:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      
      usersNotInGroup.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        fileContent += `${index + 1}. ID: ${user.id} | @${username} | ${displayName}\n`;
        fileContent += `   Status: ${user.telegramStatus}\n\n`;
      });
    }
    
    if (usersInGroup.length > 0) {
      fileContent += `USERS WITH GOBLIN ROLE IN MAIN GROUP (for reference):\n`;
      fileContent += `${'='.repeat(80)}\n`;
      
      usersInGroup.forEach((user, index) => {
        const username = user.username || 'not_set';
        const firstName = user.firstName || 'not_set';
        const lastName = user.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || username;
        
        fileContent += `${index + 1}. ID: ${user.id} | @${username} | ${displayName}\n`;
        fileContent += `   Status: ${user.telegramStatus}\n\n`;
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
    
    // Add SQL statements to remove goblin role (if needed)
    if (usersNotInGroup.length > 0) {
      fileContent += `\n\nSQL TO REMOVE GOBLIN ROLE FROM USERS NOT IN GROUP:\n`;
      fileContent += `${'='.repeat(80)}\n`;
      usersNotInGroup.forEach(user => {
        fileContent += `DELETE FROM "userRoles" WHERE "userId" = ${user.id} AND "role" = 'goblin';\n`;
      });
    }
    
    // Write to file
    fs.writeFileSync(outputFile, fileContent, 'utf8');
    console.log(`\n📄 Results saved to: ${outputFile}`);

    // Also output user IDs for easy copying
    if (usersNotInGroup.length > 0) {
      console.log('\n📋 User IDs NOT in group (comma-separated):');
      console.log(usersNotInGroup.map(u => u.id).join(', '));
      
      console.log('\n📋 User IDs NOT in group (one per line):');
      usersNotInGroup.forEach(user => console.log(user.id));
    }

  } catch (error) {
    console.error('❌ Error finding users:', error);
  } finally {
    await knex.destroy();
    process.exit(0);
  }
}

// Run the script
findGoblinUsersNotInGroup();

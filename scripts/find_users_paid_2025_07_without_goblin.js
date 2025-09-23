#!/usr/bin/env node

/**
 * Find users who paid for 2025_07 but don't have the goblin role
 */

require('dotenv').config();
const knex = require('../modules/db/knex');
const fs = require('fs');
const path = require('path');

async function findUsersPaid202507WithoutGoblin() {
  try {
    console.log('🔍 Finding users who paid for 2025_07 without goblin role...\n');
    
    // Get users who paid for 2025_07 but don't have goblin role
    const users = await knex('users')
      .select(
        'users.id',
        'users.username',
        'users.firstName',
        'users.lastName',
        'userGroups.period',
        'userGroups.type'
      )
      .leftJoin('userGroups', 'users.id', 'userGroups.userId')
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .where('userGroups.period', '2025_07')
      .whereNotExists(function() {
        this.select('*')
          .from('userRoles as ur')
          .whereRaw('ur."userId" = users.id')
          .andWhere('ur.role', 'goblin');
      })
      .orderBy('users.id');

    console.log(`📊 Found ${users.length} users who paid for 2025_07 without goblin role\n`);

    if (users.length === 0) {
      console.log('✅ All users who paid for 2025_07 have the goblin role!');
      return;
    }

    // Display users
    console.log('👥 Users who paid for 2025_07 without goblin role:');
    console.log('─'.repeat(80));
    
    users.forEach((user, index) => {
      const username = user.username || 'not_set';
      const firstName = user.firstName || 'not_set';
      const lastName = user.lastName || '';
      const displayName = `${firstName} ${lastName}`.trim() || username;
      
      console.log(`${index + 1}. ID: ${user.id} | @${username} | ${displayName}`);
      console.log(`   Period: ${user.period} | Type: ${user.type}`);
      console.log('');
    });

    // Generate file output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(__dirname, `users_paid_2025_07_without_goblin_${timestamp}.txt`);
    
    let fileContent = `Users Who Paid for 2025_07 Without Goblin Role - ${new Date().toLocaleString()}\n`;
    fileContent += `Generated at: ${new Date().toISOString()}\n\n`;
    
    fileContent += `SUMMARY:\n`;
    fileContent += `• Total users who paid for 2025_07 without goblin role: ${users.length}\n\n`;
    
    fileContent += `USERS WHO PAID FOR 2025_07 WITHOUT GOBLIN ROLE:\n`;
    fileContent += `${'='.repeat(80)}\n`;
    
    users.forEach((user, index) => {
      const username = user.username || 'not_set';
      const firstName = user.firstName || 'not_set';
      const lastName = user.lastName || '';
      const displayName = `${firstName} ${lastName}`.trim() || username;
      
      fileContent += `${index + 1}. ID: ${user.id} | @${username} | ${displayName}\n`;
      fileContent += `   Period: ${user.period} | Type: ${user.type}\n\n`;
    });
    
    // Add SQL statements
    fileContent += `SQL TO ADD GOBLIN ROLE TO THESE USERS:\n`;
    fileContent += `${'='.repeat(80)}\n`;
    users.forEach(user => {
      fileContent += `INSERT INTO "userRoles" ("userId", "role") VALUES (${user.id}, 'goblin') ON CONFLICT DO NOTHING;\n`;
    });
    
    // Write to file
    fs.writeFileSync(outputFile, fileContent, 'utf8');
    console.log(`\n📄 Results saved to: ${outputFile}`);

    // Also output user IDs for easy copying
    console.log('\n📋 User IDs (comma-separated):');
    console.log(users.map(u => u.id).join(', '));
    
    console.log('\n📋 User IDs (one per line):');
    users.forEach(user => console.log(user.id));

  } catch (error) {
    console.error('❌ Error finding users:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the script
findUsersPaid202507WithoutGoblin();

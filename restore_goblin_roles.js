#!/usr/bin/env node

/**
 * Restore Goblin Roles Script
 * 
 * This script assigns the 'goblin' role to users who should have it based on:
 * 1. Users who have purchased months (regular or plus)
 * 2. Users who have purchased kickstarters
 * 3. Users from the export file who had spending history
 */

const knex = require('./modules/db/knex');
const fs = require('fs');
const path = require('path');

// Load the export data to identify users who should have goblin role
const exportFile = path.join(__dirname, 'user_spending_2025-09-07.json');
let exportData = null;

try {
  if (fs.existsSync(exportFile)) {
    exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    console.log(`📊 Loaded export data with ${exportData.users.length} users`);
  }
} catch (error) {
  console.log('⚠️  Could not load export file, will use database data only');
}

async function restoreGoblinRoles() {
  console.log('🔧 Restoring goblin roles for users...\n');
  
  try {
    let usersToUpdate = new Set();
    
    // Method 1: Users who have purchased months (groups)
    console.log('🔍 Finding users with purchased months...');
    const usersWithGroups = await knex('userGroups')
      .distinct('userId')
      .select('userId');
    
    usersWithGroups.forEach(user => {
      usersToUpdate.add(user.userId.toString());
    });
    console.log(`  Found ${usersWithGroups.length} users with purchased months`);
    
    // Method 2: Users who have purchased kickstarters
    console.log('🔍 Finding users with kickstarter purchases...');
    const usersWithKickstarters = await knex('userKickstarters')
      .distinct('userId')
      .select('userId');
    
    usersWithKickstarters.forEach(user => {
      usersToUpdate.add(user.userId.toString());
    });
    console.log(`  Found ${usersWithKickstarters.length} users with kickstarter purchases`);
    
    // Method 3: Users from export file who had spending
    if (exportData) {
      console.log('🔍 Finding users from export file with spending...');
      const usersWithSpending = exportData.users.filter(user => 
        user.totalSpending > 0 || 
        user.regularMonths > 0 || 
        user.plusMonths > 0 ||
        user.kickstarterCount > 0
      );
      
      usersWithSpending.forEach(user => {
        usersToUpdate.add(user.userId);
      });
      console.log(`  Found ${usersWithSpending.length} users from export with spending history`);
    }
    
    console.log(`\n📋 Total unique users to update: ${usersToUpdate.size}`);
    
    if (usersToUpdate.size === 0) {
      console.log('⚠️  No users found to update. Exiting.');
      return;
    }
    
    // Check which users already have goblin role
    const existingGoblins = await knex('userRoles')
      .where('role', 'goblin')
      .select('userId');
    
    const existingGoblinIds = new Set(existingGoblins.map(g => g.userId.toString()));
    
    // Filter out users who already have goblin role
    const usersNeedingGoblinRole = Array.from(usersToUpdate).filter(userId => 
      !existingGoblinIds.has(userId)
    );
    
    console.log(`📊 Users already with goblin role: ${existingGoblins.length}`);
    console.log(`🎯 Users needing goblin role: ${usersNeedingGoblinRole.length}`);
    
    if (usersNeedingGoblinRole.length === 0) {
      console.log('✅ All eligible users already have goblin role!');
      return;
    }
    
    // Show sample of users to be updated
    console.log('\n📝 Sample users to be updated:');
    const sampleUsers = usersNeedingGoblinRole.slice(0, 10);
    for (const userId of sampleUsers) {
      const user = await knex('users').where('id', userId).first();
      if (user) {
        console.log(`  • ${userId} (@${user.username || 'no_username'}) ${user.firstName || 'Unknown'}`);
      } else {
        console.log(`  • ${userId} (user record not found in database)`);
      }
    }
    
    if (usersNeedingGoblinRole.length > 10) {
      console.log(`  ... and ${usersNeedingGoblinRole.length - 10} more`);
    }
    
    // Ask for confirmation
    console.log(`\n⚠️  This will add 'goblin' role to ${usersNeedingGoblinRole.length} users.`);
    console.log('   This action cannot be easily undone.');
    
    // Auto-confirm for script execution (remove this if you want manual confirmation)
    const confirm = process.argv.includes('--confirm') || process.argv.includes('-y');
    
    if (!confirm) {
      console.log('\n❌ Confirmation required. Run with --confirm or -y flag to proceed.');
      console.log('   Example: node restore_goblin_roles.js --confirm');
      return;
    }
    
    // Batch insert goblin roles
    console.log('\n🔧 Adding goblin roles...');
    const roleInserts = usersNeedingGoblinRole.map(userId => ({
      userId: parseInt(userId),
      role: 'goblin'
    }));
    
    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < roleInserts.length; i += batchSize) {
      const batch = roleInserts.slice(i, i + batchSize);
      await knex('userRoles')
        .insert(batch)
        .onConflict(['userId', 'role'])
        .ignore();
      
      inserted += batch.length;
      console.log(`  Progress: ${inserted}/${roleInserts.length} users processed`);
    }
    
    console.log('\n✅ Goblin roles restored successfully!');
    
    // Verify the results
    console.log('\n📊 Final verification:');
    const totalGoblins = await knex('userRoles')
      .where('role', 'goblin')
      .count('* as count')
      .first();
    
    console.log(`  Total users with goblin role: ${totalGoblins.count}`);
    
    // Show role distribution
    const roleStats = await knex('userRoles')
      .select('role')
      .count('* as count')
      .groupBy('role')
      .orderBy('count', 'desc');
    
    console.log('\n📈 Current role distribution:');
    roleStats.forEach(stat => {
      console.log(`  • ${stat.role}: ${stat.count} users`);
    });
    
    console.log('\n🎉 Role restoration completed!');
    console.log('💡 Users should now be recognized when they use /start');
    
  } catch (error) {
    console.error('❌ Error restoring goblin roles:', error);
  } finally {
    await knex.destroy();
  }
}

// Additional function to restore specific admin roles from settings
async function restoreAdminRoles() {
  console.log('\n🔧 Restoring admin roles from settings...');
  
  // These are the admin user IDs from your settings and export
  const adminUsers = [
    { userId: '91430770', role: 'super' },      // send_dog_pics - likely main admin
    { userId: '628694430', role: 'admin' },     // Sphericalhorseinvacuum
    { userId: '101922344', role: 'adminPlus' }, // WarmDuck
    { userId: '176988041', role: 'polls' },     // Mackay
  ];
  
  for (const admin of adminUsers) {
    try {
      // Check if user exists
      const user = await knex('users').where('id', admin.userId).first();
      if (!user) {
        console.log(`  ⚠️  Admin user ${admin.userId} not found in database`);
        continue;
      }
      
      // Add admin role
      await knex('userRoles')
        .insert({
          userId: parseInt(admin.userId),
          role: admin.role
        })
        .onConflict(['userId', 'role'])
        .ignore();
      
      console.log(`  ✅ Added ${admin.role} role to user ${admin.userId} (@${user.username})`);
      
    } catch (error) {
      console.log(`  ❌ Error adding ${admin.role} role to ${admin.userId}:`, error.message);
    }
  }
}

// Run the restoration
async function main() {
  await restoreGoblinRoles();
  
  // Also restore admin roles if --admin flag is provided
  if (process.argv.includes('--admin')) {
    await restoreAdminRoles();
  }
}

main();

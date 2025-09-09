#!/usr/bin/env node

/**
 * Check Months Data Script
 * 
 * This script verifies that all month purchases from the export file
 * are properly stored in the database userGroups table
 */

const knex = require('./modules/db/knex');
const fs = require('fs');
const path = require('path');

// Load the export data
const exportFile = path.join(__dirname, 'user_spending_2025-09-07.json');
let exportData = null;

try {
  if (fs.existsSync(exportFile)) {
    exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    console.log(`📊 Loaded export data with ${exportData.users.length} users`);
  } else {
    console.log('❌ Export file not found!');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error loading export file:', error);
  process.exit(1);
}

async function checkMonthsData() {
  console.log('🔍 Checking month purchases data...\n');
  
  try {
    // Get all userGroups data from database
    const dbGroups = await knex('userGroups')
      .select('userId', 'period', 'type')
      .orderBy(['userId', 'period', 'type']);
    
    console.log(`📊 Database userGroups records: ${dbGroups.length}`);
    
    // Create lookup maps for database data
    const dbGroupsByUser = {};
    dbGroups.forEach(group => {
      const userId = group.userId.toString();
      if (!dbGroupsByUser[userId]) {
        dbGroupsByUser[userId] = { regular: [], plus: [] };
      }
      dbGroupsByUser[userId][group.type].push(group.period);
    });
    
    console.log(`📊 Users with groups in database: ${Object.keys(dbGroupsByUser).length}`);
    
    // Analyze export data vs database data
    let totalExportRegular = 0;
    let totalExportPlus = 0;
    let totalDbRegular = 0;
    let totalDbPlus = 0;
    let usersWithMissingData = [];
    let usersWithExtraData = [];
    let perfectMatches = 0;
    
    console.log('\n🔍 Comparing export vs database data...\n');
    
    // Check each user from export
    for (const exportUser of exportData.users) {
      const userId = exportUser.userId;
      const exportRegular = exportUser.regularMonths || 0;
      const exportPlus = exportUser.plusMonths || 0;
      
      totalExportRegular += exportRegular;
      totalExportPlus += exportPlus;
      
      const dbUser = dbGroupsByUser[userId];
      const dbRegular = dbUser ? dbUser.regular.length : 0;
      const dbPlus = dbUser ? dbUser.plus.length : 0;
      
      totalDbRegular += dbRegular;
      totalDbPlus += dbPlus;
      
      // Check for discrepancies
      const regularMismatch = exportRegular !== dbRegular;
      const plusMismatch = exportPlus !== dbPlus;
      
      if (regularMismatch || plusMismatch) {
        const user = await knex('users').where('id', userId).first();
        const username = user ? `@${user.username || 'no_username'}` : 'not_in_db';
        const name = user ? `${user.firstName || 'Unknown'}` : 'Unknown';
        
        if (exportRegular > 0 || exportPlus > 0) {
          usersWithMissingData.push({
            userId,
            username,
            name,
            export: { regular: exportRegular, plus: exportPlus },
            db: { regular: dbRegular, plus: dbPlus },
            missing: {
              regular: Math.max(0, exportRegular - dbRegular),
              plus: Math.max(0, exportPlus - dbPlus)
            }
          });
        }
        
        if (dbRegular > exportRegular || dbPlus > exportPlus) {
          usersWithExtraData.push({
            userId,
            username,
            name,
            export: { regular: exportRegular, plus: exportPlus },
            db: { regular: dbRegular, plus: dbPlus },
            extra: {
              regular: Math.max(0, dbRegular - exportRegular),
              plus: Math.max(0, dbPlus - exportPlus)
            }
          });
        }
      } else if ((exportRegular > 0 || exportPlus > 0) && (dbRegular > 0 || dbPlus > 0)) {
        perfectMatches++;
      }
    }
    
    // Summary statistics
    console.log('📈 Summary Statistics:');
    console.log(`  Export data:`);
    console.log(`    • Regular months: ${totalExportRegular}`);
    console.log(`    • Plus months: ${totalExportPlus}`);
    console.log(`    • Total months: ${totalExportRegular + totalExportPlus}`);
    
    console.log(`  Database data:`);
    console.log(`    • Regular months: ${totalDbRegular}`);
    console.log(`    • Plus months: ${totalDbPlus}`);
    console.log(`    • Total months: ${totalDbRegular + totalDbPlus}`);
    
    console.log(`  Comparison:`);
    console.log(`    • Perfect matches: ${perfectMatches} users`);
    console.log(`    • Users with missing data: ${usersWithMissingData.length}`);
    console.log(`    • Users with extra data: ${usersWithExtraData.length}`);
    
    // Show users with missing data
    if (usersWithMissingData.length > 0) {
      console.log('\n❌ Users with MISSING month data:');
      console.log('   (Export shows more months than database)');
      
      const topMissing = usersWithMissingData
        .sort((a, b) => (b.missing.regular + b.missing.plus) - (a.missing.regular + a.missing.plus))
        .slice(0, 10);
      
      topMissing.forEach(user => {
        const missingTotal = user.missing.regular + user.missing.plus;
        console.log(`  • ${user.userId} ${user.username} ${user.name}`);
        console.log(`    Export: ${user.export.regular}R + ${user.export.plus}P = ${user.export.regular + user.export.plus} total`);
        console.log(`    DB: ${user.db.regular}R + ${user.db.plus}P = ${user.db.regular + user.db.plus} total`);
        console.log(`    Missing: ${user.missing.regular}R + ${user.missing.plus}P = ${missingTotal} total`);
        console.log('');
      });
      
      if (usersWithMissingData.length > 10) {
        console.log(`  ... and ${usersWithMissingData.length - 10} more users with missing data`);
      }
    }
    
    // Show users with extra data
    if (usersWithExtraData.length > 0) {
      console.log('\n⚠️  Users with EXTRA month data:');
      console.log('   (Database shows more months than export)');
      
      const topExtra = usersWithExtraData
        .sort((a, b) => (b.extra.regular + b.extra.plus) - (a.extra.regular + a.extra.plus))
        .slice(0, 5);
      
      topExtra.forEach(user => {
        const extraTotal = user.extra.regular + user.extra.plus;
        console.log(`  • ${user.userId} ${user.username} ${user.name}`);
        console.log(`    Export: ${user.export.regular}R + ${user.export.plus}P = ${user.export.regular + user.export.plus} total`);
        console.log(`    DB: ${user.db.regular}R + ${user.db.plus}P = ${user.db.regular + user.db.plus} total`);
        console.log(`    Extra: ${user.extra.regular}R + ${user.extra.plus}P = ${extraTotal} total`);
        console.log('');
      });
    }
    
    // Check for users in database but not in export
    console.log('\n🔍 Checking for users in database but not in export...');
    const exportUserIds = new Set(exportData.users.map(u => u.userId));
    const dbOnlyUsers = Object.keys(dbGroupsByUser).filter(userId => !exportUserIds.has(userId));
    
    if (dbOnlyUsers.length > 0) {
      console.log(`📊 Users in database but not in export: ${dbOnlyUsers.length}`);
      
      for (const userId of dbOnlyUsers.slice(0, 5)) {
        const user = await knex('users').where('id', userId).first();
        const groups = dbGroupsByUser[userId];
        const total = groups.regular.length + groups.plus.length;
        console.log(`  • ${userId} (@${user?.username || 'no_username'}) ${user?.firstName || 'Unknown'}: ${total} months`);
      }
      
      if (dbOnlyUsers.length > 5) {
        console.log(`  ... and ${dbOnlyUsers.length - 5} more`);
      }
    }
    
    // Overall assessment
    console.log('\n🎯 Assessment:');
    const missingMonths = totalExportRegular + totalExportPlus - (totalDbRegular + totalDbPlus);
    
    if (missingMonths > 0) {
      console.log(`❌ ISSUE: ${missingMonths} months are missing from database`);
      console.log(`💡 Recommendation: Run import script to restore missing month data`);
    } else if (missingMonths < 0) {
      console.log(`⚠️  Database has ${Math.abs(missingMonths)} more months than export`);
      console.log(`💡 This might be due to newer purchases or data inconsistencies`);
    } else {
      console.log(`✅ GOOD: Total month counts match between export and database`);
    }
    
    if (usersWithMissingData.length === 0) {
      console.log(`✅ GOOD: No users have missing month data`);
    } else {
      console.log(`❌ ISSUE: ${usersWithMissingData.length} users have missing month data`);
    }
    
    console.log('\n✅ Month data check completed!');
    
  } catch (error) {
    console.error('❌ Error checking months data:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the check
checkMonthsData();

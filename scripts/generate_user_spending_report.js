#!/usr/bin/env node

/**
 * Generate User Spending Report
 * 
 * This script analyzes user spending data from the database and generates
 * a comprehensive report showing:
 * 1. Monthly subscription spending (regular months)
 * 2. Extended/Plus subscription spending 
 * 3. Kickstarter spending (if data exists)
 */

require('dotenv').config();
const knex = require('../modules/db/knex');

// Price configuration (in stars)
const REGULAR_PRICE = parseInt(process.env.REGULAR_PRICE) || 100;
const PLUS_PRICE = parseInt(process.env.PLUS_PRICE) || 200;

async function generateUserSpendingReport() {
  try {
    console.log('🔍 Generating User Spending Report...\n');

    // Get all users with their basic info
    const users = await knex('users')
      .select('id', 'username', 'firstName', 'lastName')
      .orderBy('id');

    console.log(`📊 Found ${users.length} users in database\n`);

    // Get user groups (subscriptions)
    const userGroups = await knex('userGroups')
      .select('userId', 'period', 'type')
      .orderBy('userId', 'period');

    // Get kickstarter data
    const kickstarters = await knex('kickstarters')
      .select('id', 'name', 'cost', 'pledgeCost')
      .orderBy('id');

    // Get user kickstarter purchases
    const userKickstarters = await knex('userKickstarters')
      .select('userId', 'kickstarterId', 'acquiredBy')
      .orderBy('userId', 'kickstarterId');

    // Create kickstarter lookup map
    const kickstarterMap = new Map();
    kickstarters.forEach(ks => {
      kickstarterMap.set(ks.id, {
        name: ks.name,
        cost: ks.cost,
        pledgeCost: ks.pledgeCost
      });
    });

    // Process user spending data
    const userSpending = [];

    for (const user of users) {
      const userId = user.id;
      const userGroupsData = userGroups.filter(ug => ug.userId === userId);
      const userKickstartersData = userKickstarters.filter(uk => uk.userId === userId);

      // Calculate subscription spending
      let regularMonths = 0;
      let plusMonths = 0;
      let regularSpending = 0;
      let plusSpending = 0;

      userGroupsData.forEach(ug => {
        if (ug.type === 'regular') {
          regularMonths++;
          regularSpending += REGULAR_PRICE;
        } else if (ug.type === 'plus') {
          plusMonths++;
          plusSpending += PLUS_PRICE;
        }
      });

      // Calculate kickstarter spending
      let kickstarterSpending = 0;
      let kickstarterCount = 0;
      const kickstarterDetails = [];

      userKickstartersData.forEach(uk => {
        const ks = kickstarterMap.get(uk.kickstarterId);
        if (ks) {
          kickstarterCount++;
          // Use pledgeCost if available, otherwise use cost
          const price = ks.pledgeCost || ks.cost || 0;
          kickstarterSpending += price;
          kickstarterDetails.push({
            name: ks.name,
            price: price,
            acquiredBy: uk.acquiredBy
          });
        }
      });

      const totalSpending = regularSpending + plusSpending + kickstarterSpending;

      userSpending.push({
        userId: userId,
        username: user.username || 'N/A',
        firstName: user.firstName || 'N/A',
        lastName: user.lastName || 'N/A',
        regularMonths: regularMonths,
        plusMonths: plusMonths,
        regularSpending: regularSpending,
        plusSpending: plusSpending,
        kickstarterCount: kickstarterCount,
        kickstarterSpending: kickstarterSpending,
        totalSpending: totalSpending,
        kickstarterDetails: kickstarterDetails
      });
    }

    // Sort by total spending (descending)
    userSpending.sort((a, b) => b.totalSpending - a.totalSpending);

    // Generate reports
    const fs = require('fs');
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Generate CSV export
    const csvData = generateCSV(userSpending);
    const csvFilename = `user_spending_${dateStr}.csv`;
    fs.writeFileSync(csvFilename, csvData);
    
    // Generate JSON export
    const jsonData = generateJSON(userSpending, REGULAR_PRICE, PLUS_PRICE);
    const jsonFilename = `user_spending_${dateStr}.json`;
    fs.writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
    
    // Generate human-readable report
    const report = generateReport(userSpending, REGULAR_PRICE, PLUS_PRICE);
    const txtFilename = `user_spending_report_${dateStr}.txt`;
    fs.writeFileSync(txtFilename, report);
    
    console.log(`✅ Reports generated:`);
    console.log(`   📊 CSV: ${csvFilename}`);
    console.log(`   📋 JSON: ${jsonFilename}`);
    console.log(`   📄 Text: ${txtFilename}`);
    console.log(`📈 Total users analyzed: ${userSpending.length}`);
    console.log(`💰 Total spending across all users: ${userSpending.reduce((sum, user) => sum + user.totalSpending, 0)} stars`);
    
    // Show top 10 spenders
    console.log('\n🏆 Top 10 Spenders:');
    userSpending.slice(0, 10).forEach((user, index) => {
      console.log(`${index + 1}. ${user.username || user.firstName} - ${user.totalSpending} stars (${user.regularMonths}R + ${user.plusMonths}P + ${user.kickstarterCount}KS)`);
    });

  } catch (error) {
    console.error('❌ Error generating report:', error);
  } finally {
    await knex.destroy();
  }
}

function generateCSV(userSpending) {
  let csv = 'User ID,Username,First Name,Last Name,Regular Months,Plus Months,Regular Spending,Plus Spending,Kickstarter Count,Kickstarter Spending,Total Spending\n';
  
  userSpending.forEach(user => {
    const row = [
      user.userId,
      `"${user.username}"`,
      `"${user.firstName}"`,
      `"${user.lastName}"`,
      user.regularMonths,
      user.plusMonths,
      user.regularSpending,
      user.plusSpending,
      user.kickstarterCount,
      user.kickstarterSpending,
      user.totalSpending
    ].join(',');
    csv += row + '\n';
  });
  
  return csv;
}

function generateJSON(userSpending, regularPrice, plusPrice) {
  const summary = {
    generated: new Date().toISOString(),
    regularPrice: regularPrice,
    plusPrice: plusPrice,
    totalUsers: userSpending.length,
    totalRegularMonths: userSpending.reduce((sum, user) => sum + user.regularMonths, 0),
    totalPlusMonths: userSpending.reduce((sum, user) => sum + user.plusMonths, 0),
    totalKickstarters: userSpending.reduce((sum, user) => sum + user.kickstarterCount, 0),
    totalSpending: userSpending.reduce((sum, user) => sum + user.totalSpending, 0),
    averageSpending: Math.round(userSpending.reduce((sum, user) => sum + user.totalSpending, 0) / userSpending.length)
  };
  
  return {
    summary: summary,
    users: userSpending.map(user => ({
      userId: user.userId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      regularMonths: user.regularMonths,
      plusMonths: user.plusMonths,
      regularSpending: user.regularSpending,
      plusSpending: user.plusSpending,
      kickstarterCount: user.kickstarterCount,
      kickstarterSpending: user.kickstarterSpending,
      totalSpending: user.totalSpending,
      kickstarterDetails: user.kickstarterDetails
    }))
  };
}

function generateReport(userSpending, regularPrice, plusPrice) {
  let report = '';
  
  report += '='.repeat(80) + '\n';
  report += '                    USER SPENDING REPORT\n';
  report += '='.repeat(80) + '\n';
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += `Regular Month Price: ${regularPrice} stars\n`;
  report += `Plus Month Price: ${plusPrice} stars\n`;
  report += `Total Users: ${userSpending.length}\n`;
  report += '='.repeat(80) + '\n\n';

  // Summary statistics
  const totalRegularMonths = userSpending.reduce((sum, user) => sum + user.regularMonths, 0);
  const totalPlusMonths = userSpending.reduce((sum, user) => sum + user.plusMonths, 0);
  const totalKickstarters = userSpending.reduce((sum, user) => sum + user.kickstarterCount, 0);
  const totalSpending = userSpending.reduce((sum, user) => sum + user.totalSpending, 0);

  report += 'SUMMARY STATISTICS:\n';
  report += '-'.repeat(40) + '\n';
  report += `Total Regular Months Purchased: ${totalRegularMonths}\n`;
  report += `Total Plus Months Purchased: ${totalPlusMonths}\n`;
  report += `Total Kickstarters Purchased: ${totalKickstarters}\n`;
  report += `Total Spending (Stars): ${totalSpending}\n`;
  report += `Average Spending per User: ${Math.round(totalSpending / userSpending.length)} stars\n\n`;

  // Individual user details
  report += 'INDIVIDUAL USER BREAKDOWN:\n';
  report += '='.repeat(80) + '\n\n';

  userSpending.forEach((user, index) => {
    report += (index + 1) + '. User ID: ' + user.userId + '\n';
    report += '   Username: ' + user.username + '\n';
    report += '   Name: ' + user.firstName + ' ' + user.lastName + '\n';
    report += '   Regular Months: ' + user.regularMonths + ' (' + user.regularSpending + ' stars)\n';
    report += '   Plus Months: ' + user.plusMonths + ' (' + user.plusSpending + ' stars)\n';
    report += '   Kickstarters: ' + user.kickstarterCount + ' (' + user.kickstarterSpending + ' stars)\n';
    report += '   TOTAL SPENDING: ' + user.totalSpending + ' stars\n';
    
    if (user.kickstarterDetails.length > 0) {
      report += '   Kickstarter Details:\n';
      user.kickstarterDetails.forEach(ks => {
        report += '     - ' + ks.name + ': ' + ks.price + ' stars (' + ks.acquiredBy + ')\n';
      });
    }
    
    report += '\n' + '-'.repeat(80) + '\n\n';
  });

  return report;
}

// Run the script
if (require.main === module) {
  generateUserSpendingReport();
}

module.exports = { generateUserSpendingReport };
#!/usr/bin/env node

/**
 * Interactive script to review and update kickstarter prices
 * 
 * This script allows you to:
 * 1. Review each kickstarter individually
 * 2. Set custom prices or use suggested prices
 * 3. Skip kickstarters that don't need updates
 */

require('dotenv').config();
const knex = require('../modules/db/knex');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function suggestStarsPrice(pledgeCost, currentCost) {
  const pledgeAmount = parseFloat(pledgeCost) || 0;
  
  if (pledgeAmount <= 0) {
    return 50;
  } else if (pledgeAmount <= 25) {
    return 50;
  } else if (pledgeAmount <= 50) {
    return 100;
  } else if (pledgeAmount <= 100) {
    return 150;
  } else if (pledgeAmount <= 200) {
    return 250;
  } else {
    return 350;
  }
}

async function displayKickstarter(ks, index, total) {
  const suggestedPrice = suggestStarsPrice(ks.pledgeCost, ks.cost);
  
  console.log(`\n📦 Kickstarter ${index + 1}/${total}`);
  console.log('─'.repeat(60));
  console.log(`ID: ${ks.id}`);
  console.log(`Name: ${ks.name}`);
  console.log(`Creator: ${ks.creator}`);
  console.log(`Pledge: ${ks.pledgeName} ($${ks.pledgeCost})`);
  console.log(`Current Cost: ${ks.cost}`);
  console.log(`Suggested Stars: ${suggestedPrice} ⭐`);
  console.log(`Link: ${ks.link}`);
  console.log('─'.repeat(60));
}

async function updateKickstarterPrice(id, newPrice) {
  await knex('kickstarters')
    .where('id', id)
    .update({ cost: newPrice });
    
  console.log(`✅ Updated kickstarter ID ${id} to ${newPrice} ⭐`);
}

async function main() {
  try {
    console.log('🚀 Starting interactive kickstarter price review...\n');
    
    const kickstarters = await knex('kickstarters')
      .select('id', 'name', 'creator', 'cost', 'pledgeName', 'pledgeCost', 'link')
      .orderBy('id');
    
    if (kickstarters.length === 0) {
      console.log('📭 No kickstarters found in the database.');
      return;
    }
    
    console.log(`📊 Found ${kickstarters.length} kickstarters to review.\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (let i = 0; i < kickstarters.length; i++) {
      const ks = kickstarters[i];
      
      await displayKickstarter(ks, i, kickstarters.length);
      
      const action = await askQuestion('\nWhat would you like to do? (s=use suggested, c=enter custom price, k=skip, q=quit): ');
      
      if (action.toLowerCase() === 'q') {
        console.log('\n👋 Quitting...');
        break;
      }
      
      if (action.toLowerCase() === 'k') {
        console.log(`⏭️  Skipped kickstarter ID ${ks.id}`);
        skipped++;
        continue;
      }
      
      let newPrice;
      
      if (action.toLowerCase() === 's') {
        newPrice = suggestStarsPrice(ks.pledgeCost, ks.cost);
        console.log(`💰 Using suggested price: ${newPrice} ⭐`);
      } else if (action.toLowerCase() === 'c') {
        const priceInput = await askQuestion('Enter new price in stars: ');
        newPrice = parseInt(priceInput);
        
        if (isNaN(newPrice) || newPrice <= 0) {
          console.log('❌ Invalid price. Skipping...');
          skipped++;
          continue;
        }
        
        console.log(`💰 Using custom price: ${newPrice} ⭐`);
      } else {
        console.log('❌ Invalid option. Skipping...');
        skipped++;
        continue;
      }
      
      // Confirm the update
      const confirm = await askQuestion(`Confirm updating kickstarter "${ks.name}" to ${newPrice} ⭐? (y/n): `);
      
      if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
        await updateKickstarterPrice(ks.id, newPrice);
        updated++;
      } else {
        console.log('❌ Update cancelled.');
        skipped++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updated} kickstarters`);
    console.log(`⏭️  Skipped: ${skipped} kickstarters`);
    console.log(`📦 Total processed: ${updated + skipped} kickstarters`);
    
    console.log('\n🎉 Kickstarter price update complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
    await knex.destroy();
  }
}

if (require.main === module) {
  main();
}

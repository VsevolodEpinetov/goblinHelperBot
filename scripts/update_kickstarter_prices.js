#!/usr/bin/env node

/**
 * Script to update all kickstarter prices to use Telegram Stars
 * 
 * This script will:
 * 1. Fetch all existing kickstarters from the database
 * 2. Display current prices for review
 * 3. Allow setting new prices in Telegram Stars
 * 4. Update the database with new prices
 */

require('dotenv').config();
const knex = require('../modules/db/knex');

// Price conversion logic - you can adjust these based on your pricing strategy
const PRICE_CONVERSION_RULES = {
  // Example conversion rules - adjust as needed
  // 'default': 100,  // Default price in stars if no specific rule matches
  
  // You can add specific rules based on original pledge cost or other factors
  // For example:
  // 'low_cost': 50,    // For pledge costs < $50
  // 'medium_cost': 100, // For pledge costs $50-100
  // 'high_cost': 200,   // For pledge costs > $100
};

async function getCurrentKickstarters() {
  console.log('📊 Fetching current kickstarters...');
  
  const kickstarters = await knex('kickstarters')
    .select('id', 'name', 'creator', 'cost', 'pledgeName', 'pledgeCost', 'link')
    .orderBy('id');
    
  return kickstarters;
}

function suggestStarsPrice(pledgeCost, currentCost) {
  // Convert pledge cost from string to number
  const pledgeAmount = parseFloat(pledgeCost) || 0;
  
  // Simple conversion logic - adjust as needed
  // This is just a starting point - you should customize based on your pricing strategy
  
  if (pledgeAmount <= 0) {
    return 50; // Default for projects without pledge cost
  } else if (pledgeAmount <= 25) {
    return 50; // Small projects
  } else if (pledgeAmount <= 50) {
    return 100; // Medium projects  
  } else if (pledgeAmount <= 100) {
    return 150; // Large projects
  } else if (pledgeAmount <= 200) {
    return 250; // Very large projects
  } else {
    return 350; // Premium projects
  }
}

async function updateKickstarterPrice(id, newPrice) {
  await knex('kickstarters')
    .where('id', id)
    .update({ cost: newPrice });
    
  console.log(`✅ Updated kickstarter ID ${id} to ${newPrice} ⭐`);
}

async function displayKickstarters(kickstarters) {
  console.log('\n🎯 Current Kickstarters:');
  console.log('=' .repeat(80));
  
  for (const ks of kickstarters) {
    const suggestedPrice = suggestStarsPrice(ks.pledgeCost, ks.cost);
    
    console.log(`\n📦 ID: ${ks.id}`);
    console.log(`   Name: ${ks.name}`);
    console.log(`   Creator: ${ks.creator}`);
    console.log(`   Pledge: ${ks.pledgeName} ($${ks.pledgeCost})`);
    console.log(`   Current Cost: ${ks.cost}`);
    console.log(`   Suggested Stars: ${suggestedPrice} ⭐`);
    console.log(`   Link: ${ks.link}`);
  }
  
  console.log('\n' + '=' .repeat(80));
}

async function updateAllPrices(kickstarters, useSuggested = true, customPrices = {}) {
  console.log('\n🔄 Updating kickstarter prices...');
  
  let updated = 0;
  
  for (const ks of kickstarters) {
    let newPrice;
    
    if (customPrices[ks.id]) {
      newPrice = customPrices[ks.id];
    } else if (useSuggested) {
      newPrice = suggestStarsPrice(ks.pledgeCost, ks.cost);
    } else {
      console.log(`⚠️  Skipping kickstarter ID ${ks.id} - no price provided`);
      continue;
    }
    
    await updateKickstarterPrice(ks.id, newPrice);
    updated++;
  }
  
  console.log(`\n✅ Successfully updated ${updated} kickstarters!`);
}

async function main() {
  try {
    console.log('🚀 Starting kickstarter price update...\n');
    
    // Get current kickstarters
    const kickstarters = await getCurrentKickstarters();
    
    if (kickstarters.length === 0) {
      console.log('📭 No kickstarters found in the database.');
      return;
    }
    
    // Display current kickstarters with suggested prices
    await displayKickstarters(kickstarters);
    
    // For now, we'll use the suggested prices
    // In a real scenario, you might want to review each one individually
    console.log('\n💡 Using suggested prices based on pledge cost...');
    
    await updateAllPrices(kickstarters, true);
    
    console.log('\n🎉 All kickstarter prices have been updated to use Telegram Stars!');
    console.log('📝 Remember to update any display logic to show ⭐ instead of ₽');
    
  } catch (error) {
    console.error('❌ Error updating kickstarter prices:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  getCurrentKickstarters,
  suggestStarsPrice,
  updateKickstarterPrice,
  updateAllPrices
};

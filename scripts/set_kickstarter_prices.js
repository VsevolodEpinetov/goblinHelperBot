#!/usr/bin/env node

/**
 * Simple script to set kickstarter prices in Telegram Stars
 * 
 * Usage:
 * node scripts/set_kickstarter_prices.js
 * 
 * This will update all kickstarter prices based on their pledge costs
 */

require('dotenv').config();
const { getAllKickstartersWithPrices, updateKickstarterPrice } = require('../modules/db/helpers');
const knex = require('../modules/db/knex');

// Simple 1.1x multiplier for current prices
function getStarsPrice(currentPrice) {
  const currentAmount = parseFloat(currentPrice) || 0;
  return Math.round(currentAmount * 1.1);
}

async function main() {
  try {
    console.log('🚀 Setting kickstarter prices to Telegram Stars...\n');
    
    // Get all kickstarters
    const kickstarters = await getAllKickstartersWithPrices();
    
    if (kickstarters.length === 0) {
      console.log('📭 No kickstarters found in the database.');
      return;
    }
    
    console.log(`📊 Found ${kickstarters.length} kickstarters to update.\n`);
    
    let updated = 0;
    
    // Update each kickstarter
    for (const ks of kickstarters) {
      const newPrice = getStarsPrice(ks.cost);
      
      console.log(`📦 Updating "${ks.name}" by ${ks.creator}`);
      console.log(`   Current price: ${ks.cost}`);
      console.log(`   New price: ${newPrice} ⭐ (1.1x increase)`);
      
      await updateKickstarterPrice(ks.id, newPrice);
      updated++;
    }
    
    console.log(`\n✅ Successfully updated ${updated} kickstarters to use Telegram Stars!`);
    console.log('\n📝 All prices increased by exactly 1.1x (10% increase)');
    
  } catch (error) {
    console.error('❌ Error updating kickstarter prices:', error);
  } finally {
    await knex.destroy();
  }
}

if (require.main === module) {
  main();
}

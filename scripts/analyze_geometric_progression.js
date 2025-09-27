/**
 * Analyze what a geometric progression level system would look like
 * Based on the user's memory of geometric progression
 */

const rpgConfig = require('../configs/rpg');

// Current system constants
const XP_A = rpgConfig.xp.A;
const XP_B = rpgConfig.xp.B;

function computeXpFromSpending(totalUnits) {
  if (!totalUnits || totalUnits <= 0) return 0;
  return Math.floor(XP_A * Math.pow(totalUnits, XP_B));
}

// Geometric progression formulas
function calculateGeometricLevels(baseXp = 1000, multiplier = 1.5, maxLevels = 100) {
  const levels = [];
  let currentXp = 0;
  
  for (let level = 1; level <= maxLevels; level++) {
    const xpRequired = Math.floor(baseXp * Math.pow(multiplier, level - 1));
    const totalXp = currentXp + xpRequired;
    currentXp = totalXp;
    
    levels.push({
      level,
      xpRequired,
      totalXp,
      tier: getTierFromXp(totalXp)
    });
    
    // Stop if we reach a reasonable maximum
    if (totalXp > 1000000) break;
  }
  
  return levels;
}

function getTierFromXp(totalXp) {
  if (totalXp < 2000) return '🪵 Wood';
  if (totalXp < 5000) return '🥉 Bronze';
  if (totalXp < 10000) return '🥈 Silver';
  if (totalXp < 20000) return '🥇 Gold';
  if (totalXp < 40000) return '💎 Platinum';
  if (totalXp < 80000) return '💠 Diamond';
  if (totalXp < 160000) return '⚔️ Mithril';
  return '👑 Legend';
}

function analyzeGeometricProgression() {
  console.log('🎮 Geometric Progression Level Analysis\n');
  console.log('=' .repeat(80));
  
  // Test different geometric progressions
  const progressions = [
    { name: 'Moderate (1.3x)', base: 1000, multiplier: 1.3 },
    { name: 'Standard (1.5x)', base: 1000, multiplier: 1.5 },
    { name: 'Steep (1.8x)', base: 1000, multiplier: 1.8 },
    { name: 'Very Steep (2.0x)', base: 1000, multiplier: 2.0 }
  ];
  
  for (const progression of progressions) {
    console.log(`\n📈 ${progression.name} Progression:`);
    console.log('-'.repeat(60));
    
    const levels = calculateGeometricLevels(progression.base, progression.multiplier, 20);
    
    console.log('Level | XP Required | Total XP  | Tier');
    console.log('------|-------------|-----------|----------');
    
    for (let i = 0; i < Math.min(15, levels.length); i++) {
      const level = levels[i];
      console.log(
        `${level.level.toString().padStart(5)} | ${level.xpRequired.toLocaleString().padStart(11)} | ${level.totalXp.toLocaleString().padStart(9)} | ${level.tier}`
      );
    }
    
    if (levels.length > 15) {
      console.log('...   | ...         | ...       | ...');
      const lastLevel = levels[levels.length - 1];
      console.log(
        `${lastLevel.level.toString().padStart(5)} | ${lastLevel.xpRequired.toLocaleString().padStart(11)} | ${lastLevel.totalXp.toLocaleString().padStart(9)} | ${lastLevel.tier}`
      );
    }
  }
  
  console.log('\n🎯 COMPARISON WITH CURRENT SYSTEM:');
  console.log('=' .repeat(80));
  
  // Compare with current subscription values
  const regularXp = computeXpFromSpending(600);
  const plusXp = computeXpFromSpending(1600);
  
  console.log(`Current subscription XP values:`);
  console.log(`- Regular subscription: ${regularXp} XP`);
  console.log(`- Plus subscription: ${plusXp} XP`);
  console.log(`- Kickstarter: ${computeXpFromSpending(300)} XP`);
  
  console.log(`\nHow many subscriptions needed for each tier (1.5x progression):`);
  const geoLevels = calculateGeometricLevels(1000, 1.5, 50);
  
  const tiers = [
    { name: 'Bronze', minXp: 2000 },
    { name: 'Silver', minXp: 5000 },
    { name: 'Gold', minXp: 10000 },
    { name: 'Platinum', minXp: 20000 },
    { name: 'Diamond', minXp: 40000 },
    { name: 'Mithril', minXp: 80000 },
    { name: 'Legend', minXp: 160000 }
  ];
  
  for (const tier of tiers) {
    const level = geoLevels.find(l => l.totalXp >= tier.minXp);
    if (level) {
      const regularSubs = Math.ceil(level.totalXp / regularXp);
      const plusSubs = Math.ceil(level.totalXp / plusXp);
      console.log(`${tier.name}: Level ${level.level} (${level.totalXp.toLocaleString()} XP) - ${regularSubs} regular or ${plusSubs} plus subscriptions`);
    }
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('=' .repeat(80));
  console.log('1. Current linear system is simple but may not provide enough progression depth');
  console.log('2. Geometric progression creates more meaningful level differences');
  console.log('3. 1.5x multiplier provides good balance between accessibility and prestige');
  console.log('4. Consider implementing geometric progression for better user engagement');
}

// Run the analysis
analyzeGeometricProgression();

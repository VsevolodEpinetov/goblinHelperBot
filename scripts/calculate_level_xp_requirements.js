/**
 * Calculate XP requirements for each level using the comprehensive RPG logic
 */

const rpgConfig = require('../configs/rpg');

const TIERS = rpgConfig.tiers;

function getTierAndLevel(totalXp) {
  const tier = TIERS.find(t => totalXp >= t.min && totalXp <= t.max) || TIERS[TIERS.length - 1];
  if (tier.name === 'legend') {
    // Legend: level is 1 + extra per 10k beyond 160k (arbitrary simple rule)
    const extra = Math.max(0, Math.floor((totalXp - 160000) / 10000));
    return { tier: 'legend', level: 1 + extra, nextLevelAt: null };
  }
  const span = tier.max - tier.min + 1;
  const step = Math.floor(span / 10);
  const within = Math.max(0, totalXp - tier.min);
  const level = Math.min(10, Math.floor(within / step) + 1);
  const nextLevelAt = Math.min(tier.max, tier.min + level * step);
  return { tier: tier.name, level, nextLevelAt };
}

function calculateLevelRequirements() {
  console.log('🎮 RPG Level XP Requirements\n');
  console.log('=' .repeat(60));
  
  for (const tier of TIERS) {
    console.log(`\n${getTierEmoji(tier.name)} ${tier.name.toUpperCase()} TIER (${tier.min} - ${tier.max === Number.POSITIVE_INFINITY ? '∞' : tier.max} XP)`);
    console.log('-'.repeat(50));
    
    if (tier.name === 'legend') {
      // Special handling for Legend tier
      console.log(`Level 1: ${tier.min} XP (minimum)`);
      for (let level = 2; level <= 10; level++) {
        const xpRequired = tier.min + ((level - 1) * 10000);
        console.log(`Level ${level}: ${xpRequired.toLocaleString()} XP`);
      }
      console.log(`Level 11+: Every 10,000 XP = +1 level`);
    } else {
      // Regular tier calculation
      const span = tier.max - tier.min + 1;
      const step = Math.floor(span / 10);
      
      for (let level = 1; level <= 10; level++) {
        const xpRequired = tier.min + ((level - 1) * step);
        const nextLevelXp = level < 10 ? tier.min + (level * step) : tier.max;
        const xpToNext = nextLevelXp - xpRequired;
        
        console.log(`Level ${level}: ${xpRequired.toLocaleString()} XP (${xpToNext.toLocaleString()} to next)`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY BY TIER:');
  console.log('='.repeat(60));
  
  for (const tier of TIERS) {
    const span = tier.max - tier.min + 1;
    const step = Math.floor(span / 10);
    console.log(`${getTierEmoji(tier.name)} ${tier.name.toUpperCase()}: ${step.toLocaleString()} XP per level (${tier.min.toLocaleString()} - ${tier.max === Number.POSITIVE_INFINITY ? '∞' : tier.max.toLocaleString()})`);
  }
  
  console.log('\n🎯 PRACTICAL EXAMPLES:');
  console.log('='.repeat(60));
  
  // Show some practical examples
  const examples = [
    { name: 'Regular Subscription', xp: 2147 },
    { name: 'Plus Subscription', xp: 3156 },
    { name: 'Kickstarter', xp: 1635 },
    { name: 'Raid Creation', xp: 75 },
    { name: 'Raid Participation', xp: 50 }
  ];
  
  for (const example of examples) {
    const { tier, level, nextLevelAt } = getTierAndLevel(example.xp);
    const tierInfo = getTierDisplayInfo(tier);
    console.log(`${example.name}: ${example.xp} XP → ${tierInfo.name} Level ${level}`);
  }
}

function getTierEmoji(tierName) {
  const emojis = {
    'wood': '🪵',
    'bronze': '🥉',
    'silver': '🥈',
    'gold': '🥇',
    'platinum': '💎',
    'diamond': '💠',
    'mithril': '⚔️',
    'legend': '👑'
  };
  return emojis[tierName] || '⭐';
}

function getTierDisplayInfo(tier) {
  const tierInfo = {
    'wood': { name: '🪵 Wood' },
    'bronze': { name: '🥉 Bronze' },
    'silver': { name: '🥈 Silver' },
    'gold': { name: '🥇 Gold' },
    'platinum': { name: '💎 Platinum' },
    'diamond': { name: '💠 Diamond' },
    'mithril': { name: '⚔️ Mithril' },
    'legend': { name: '👑 Legend' }
  };
  return tierInfo[tier] || { name: '⭐ Unknown' };
}

// Run the calculation
calculateLevelRequirements();

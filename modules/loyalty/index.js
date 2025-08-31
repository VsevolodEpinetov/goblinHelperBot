/**
 * Loyalty Rewards System
 * 
 * Basic level system without points (simplified version)
 */

const knex = require('../db/knex');

// Level definitions - 10 materials with 3 sublevels each
const LEVELS = {
  // Tier 1: Basic Materials
  'bronze_3': { name: '🥉 Bronze III', material: 'bronze', sublevel: 3, tier: 1, discount: 0 },
  'bronze_2': { name: '🥉 Bronze II', material: 'bronze', sublevel: 2, tier: 1, discount: 1 },
  'bronze_1': { name: '🥉 Bronze I', material: 'bronze', sublevel: 1, tier: 1, discount: 2 },
  
  'copper_3': { name: '🟠 Copper III', material: 'copper', sublevel: 3, tier: 1, discount: 3 },
  'copper_2': { name: '🟠 Copper II', material: 'copper', sublevel: 2, tier: 1, discount: 4 },
  'copper_1': { name: '🟠 Copper I', material: 'copper', sublevel: 1, tier: 1, discount: 5 },
  
  'iron_3': { name: '⚫ Iron III', material: 'iron', sublevel: 3, tier: 1, discount: 6 },
  'iron_2': { name: '⚫ Iron II', material: 'iron', sublevel: 2, tier: 1, discount: 7 },
  'iron_1': { name: '⚫ Iron I', material: 'iron', sublevel: 1, tier: 1, discount: 8 },
  
  // Tier 2: Intermediate Materials
  'steel_3': { name: '🔘 Steel III', material: 'steel', sublevel: 3, tier: 2, discount: 9 },
  'steel_2': { name: '🔘 Steel II', material: 'steel', sublevel: 2, tier: 2, discount: 10 },
  'steel_1': { name: '🔘 Steel I', material: 'steel', sublevel: 1, tier: 2, discount: 11 },
  
  'silver_3': { name: '🥈 Silver III', material: 'silver', sublevel: 3, tier: 2, discount: 12 },
  'silver_2': { name: '🥈 Silver II', material: 'silver', sublevel: 2, tier: 2, discount: 13 },
  'silver_1': { name: '🥈 Silver I', material: 'silver', sublevel: 1, tier: 2, discount: 14 },
  
  // Tier 3: Precious Materials
  'gold_3': { name: '🥇 Gold III', material: 'gold', sublevel: 3, tier: 3, discount: 15 },
  'gold_2': { name: '🥇 Gold II', material: 'gold', sublevel: 2, tier: 3, discount: 16 },
  'gold_1': { name: '🥇 Gold I', material: 'gold', sublevel: 1, tier: 3, discount: 17 },
  
  'platinum_3': { name: '💎 Platinum III', material: 'platinum', sublevel: 3, tier: 3, discount: 18 },
  'platinum_2': { name: '💎 Platinum II', material: 'platinum', sublevel: 2, tier: 3, discount: 19 },
  'platinum_1': { name: '💎 Platinum I', material: 'platinum', sublevel: 1, tier: 3, discount: 20 },
  
  // Tier 4: Legendary Materials
  'diamond_3': { name: '💠 Diamond III', material: 'diamond', sublevel: 3, tier: 4, discount: 22 },
  'diamond_2': { name: '💠 Diamond II', material: 'diamond', sublevel: 2, tier: 4, discount: 24 },
  'diamond_1': { name: '💠 Diamond I', material: 'diamond', sublevel: 1, tier: 4, discount: 26 },
  
  'adamantium_3': { name: '⚔️ Adamantium III', material: 'adamantium', sublevel: 3, tier: 4, discount: 28 },
  'adamantium_2': { name: '⚔️ Adamantium II', material: 'adamantium', sublevel: 2, tier: 4, discount: 30 },
  'adamantium_1': { name: '⚔️ Adamantium I', material: 'adamantium', sublevel: 1, tier: 4, discount: 35 }
};

// Material tier information
const MATERIAL_TIERS = {
  1: { name: 'Basic Materials', description: 'Starting your journey' },
  2: { name: 'Intermediate Materials', description: 'Growing stronger' },
  3: { name: 'Precious Materials', description: 'Elite status' },
  4: { name: 'Legendary Materials', description: 'Master level' }
};

/**
 * Get user loyalty data
 */
async function getUserLoyalty(userId) {
  try {
    let loyalty = await knex('userLoyalty').where('userId', userId).first();
    
    if (!loyalty) {
      // Create new loyalty record
      loyalty = await knex('userLoyalty').insert({
        userId: userId,
        level: 'bronze_3'
      }).returning('*').then(rows => rows[0]);
    }
    
    return loyalty;
  } catch (error) {
    console.error('Error getting user loyalty:', error);
    return null;
  }
}

/**
 * Set user level directly
 */
async function setUserLevel(userId, level) {
  try {
    if (!LEVELS[level]) {
      return { success: false, message: 'Invalid level' };
    }
    
    await knex('userLoyalty')
      .insert({ userId, level })
      .onConflict('userId')
      .merge({ level, updatedAt: knex.fn.now() });
    
    return { success: true, level };
  } catch (error) {
    console.error('Error setting user level:', error);
    return { success: false, message: 'Database error' };
  }
}

/**
 * Get level information
 */
function getLevelInfo(level) {
  return LEVELS[level] || LEVELS.bronze_3;
}

/**
 * Get next level
 */
function getNextLevel(currentLevel) {
  const levelKeys = Object.keys(LEVELS);
  const currentIndex = levelKeys.indexOf(currentLevel);
  return currentIndex < levelKeys.length - 1 ? levelKeys[currentIndex + 1] : null;
}

/**
 * Get previous level
 */
function getPreviousLevel(currentLevel) {
  const levelKeys = Object.keys(LEVELS);
  const currentIndex = levelKeys.indexOf(currentLevel);
  return currentIndex > 0 ? levelKeys[currentIndex - 1] : null;
}

/**
 * Get level benefits based on tier
 */
function getLevelBenefits(level) {
  const levelInfo = getLevelInfo(level);
  const tier = levelInfo.tier;
  
  const tierBenefits = {
    1: [
      'Basic access to STL files',
      'Can participate in polls',
      'Basic support'
    ],
    2: [
      'All Tier 1 benefits',
      'Priority support',
      'Access to exclusive content',
      'Can submit content for review',
      `${levelInfo.discount}% discount on purchases`
    ],
    3: [
      'All Tier 2 benefits',
      'Early access to new releases',
      'Can create polls',
      `${levelInfo.discount}% discount on purchases`,
      'Custom profile badge',
      'VIP support channel'
    ],
    4: [
      'All Tier 3 benefits',
      'Beta tester access',
      'Can suggest new features',
      `${levelInfo.discount}% discount on purchases`,
      'Personal admin contact',
      'Annual meetup invitation',
      'Exclusive Discord role'
    ]
  };
  
  return tierBenefits[tier] || tierBenefits[1];
}

/**
 * Get material progression info
 */
function getMaterialProgression(level) {
  const levelInfo = getLevelInfo(level);
  const material = levelInfo.material;
  
  const materialLevels = Object.values(LEVELS).filter(l => l.material === material);
  const currentSublevel = levelInfo.sublevel;
  
  return {
    material: material,
    currentSublevel: currentSublevel,
    totalSublevels: 3,
    isMaxSublevel: currentSublevel === 1,
    isMinSublevel: currentSublevel === 3,
    nextMaterial: getNextMaterial(material)
  };
}

/**
 * Get next material in progression
 */
function getNextMaterial(currentMaterial) {
  const materials = ['bronze', 'copper', 'iron', 'steel', 'silver', 'gold', 'platinum', 'diamond', 'adamantium'];
  const currentIndex = materials.indexOf(currentMaterial);
  return currentIndex < materials.length - 1 ? materials[currentIndex + 1] : null;
}

/**
 * Get all users with a specific level
 */
async function getUsersWithLevel(level) {
  try {
    return await knex('userLoyalty')
      .where('level', level)
      .select('userId');
  } catch (error) {
    console.error('Error getting users with level:', error);
    return [];
  }
}

/**
 * Get leaderboard (simplified - just by level order)
 */
async function getLeaderboard(limit = 10) {
  try {
    return await knex('userLoyalty')
      .join('users', 'userLoyalty.userId', 'users.id')
      .select(
        'userLoyalty.userId',
        'userLoyalty.level',
        'users.firstName',
        'users.lastName',
        'users.username'
      )
      .orderByRaw(`
        CASE 
          WHEN userLoyalty.level = 'adamantium_1' THEN 1
          WHEN userLoyalty.level = 'adamantium_2' THEN 2
          WHEN userLoyalty.level = 'adamantium_3' THEN 3
          WHEN userLoyalty.level = 'diamond_1' THEN 4
          WHEN userLoyalty.level = 'diamond_2' THEN 5
          WHEN userLoyalty.level = 'diamond_3' THEN 6
          WHEN userLoyalty.level = 'platinum_1' THEN 7
          WHEN userLoyalty.level = 'platinum_2' THEN 8
          WHEN userLoyalty.level = 'platinum_3' THEN 9
          WHEN userLoyalty.level = 'gold_1' THEN 10
          WHEN userLoyalty.level = 'gold_2' THEN 11
          WHEN userLoyalty.level = 'gold_3' THEN 12
          WHEN userLoyalty.level = 'silver_1' THEN 13
          WHEN userLoyalty.level = 'silver_2' THEN 14
          WHEN userLoyalty.level = 'silver_3' THEN 15
          WHEN userLoyalty.level = 'steel_1' THEN 16
          WHEN userLoyalty.level = 'steel_2' THEN 17
          WHEN userLoyalty.level = 'steel_3' THEN 18
          WHEN userLoyalty.level = 'iron_1' THEN 19
          WHEN userLoyalty.level = 'iron_2' THEN 20
          WHEN userLoyalty.level = 'iron_3' THEN 21
          WHEN userLoyalty.level = 'copper_1' THEN 22
          WHEN userLoyalty.level = 'copper_2' THEN 23
          WHEN userLoyalty.level = 'copper_3' THEN 24
          WHEN userLoyalty.level = 'bronze_1' THEN 25
          WHEN userLoyalty.level = 'bronze_2' THEN 26
          WHEN userLoyalty.level = 'bronze_3' THEN 27
          ELSE 28
        END
      `)
      .limit(limit);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

module.exports = {
  getUserLoyalty,
  setUserLevel,
  getLevelInfo,
  getNextLevel,
  getPreviousLevel,
  getLevelBenefits,
  getMaterialProgression,
  getUsersWithLevel,
  getLeaderboard,
  LEVELS,
  MATERIAL_TIERS
};

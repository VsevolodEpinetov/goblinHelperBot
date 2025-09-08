/**
 * Loyalty Rewards System
 * 
 * Uses RPG tiers from configs/rpg.js as the single source of truth
 */

const knex = require('../db/knex');
const rpgConfig = require('../../configs/rpg');

// Use RPG tiers as the level system
const TIERS = rpgConfig.tiers;

// Tier display names and emojis
const TIER_INFO = {
  'wood': { name: '🪵 Wood', emoji: '🪵', discount: 0, description: 'Starting your journey' },
  'bronze': { name: '🥉 Bronze', emoji: '🥉', discount: 5, description: 'Basic crafting' },
  'silver': { name: '🥈 Silver', emoji: '🥈', discount: 10, description: 'Growing stronger' },
  'gold': { name: '🥇 Gold', emoji: '🥇', discount: 15, description: 'Elite status' },
  'platinum': { name: '💎 Platinum', emoji: '💎', discount: 20, description: 'Premium tier' },
  'diamond': { name: '💠 Diamond', emoji: '💠', discount: 25, description: 'Legendary status' },
  'mithril': { name: '⚔️ Mithril', emoji: '⚔️', discount: 30, description: 'Master level' },
  'legend': { name: '👑 Legend', emoji: '👑', discount: 35, description: 'Ultimate mastery' }
};

/**
 * Get user loyalty data
 */
async function getUserLoyalty(userId) {
  try {
    let loyalty = await knex('userLoyalty').where('userId', userId).first();
    
    if (!loyalty) {
      // Create new loyalty record with default tier
      loyalty = await knex('userLoyalty').insert({
        userId: userId,
        level: 'wood'
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
    if (!TIER_INFO[level]) {
      return { success: false, message: 'Invalid tier' };
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
 * Get tier information
 */
function getLevelInfo(level) {
  const tierInfo = TIER_INFO[level];
  if (!tierInfo) return TIER_INFO.wood;
  
  return {
    name: tierInfo.name,
    emoji: tierInfo.emoji,
    discount: tierInfo.discount,
    description: tierInfo.description,
    tier: level
  };
}

/**
 * Get next tier
 */
function getNextLevel(currentLevel) {
  const tierNames = TIERS.map(t => t.name);
  const currentIndex = tierNames.indexOf(currentLevel);
  return currentIndex < tierNames.length - 1 ? tierNames[currentIndex + 1] : null;
}

/**
 * Get previous tier
 */
function getPreviousLevel(currentLevel) {
  const tierNames = TIERS.map(t => t.name);
  const currentIndex = tierNames.indexOf(currentLevel);
  return currentIndex > 0 ? tierNames[currentIndex - 1] : null;
}

/**
 * Get level benefits based on tier
 */
function getLevelBenefits(level) {
  const levelInfo = getLevelInfo(level);
  
  const tierBenefits = {
    'wood': [
      'Basic access to STL files',
      'Can participate in polls',
      'Basic support'
    ],
    'bronze': [
      'All Wood benefits',
      'Priority support',
      'Access to exclusive content',
      'Can submit content for review',
      `${levelInfo.discount}% discount on purchases`
    ],
    'silver': [
      'All Bronze benefits',
      'Early access to new releases',
      'Can create polls',
      `${levelInfo.discount}% discount on purchases`,
      'Custom profile badge'
    ],
    'gold': [
      'All Silver benefits',
      'VIP support channel',
      'Beta tester access',
      `${levelInfo.discount}% discount on purchases`,
      'Can suggest new features'
    ],
    'platinum': [
      'All Gold benefits',
      'Personal admin contact',
      `${levelInfo.discount}% discount on purchases`,
      'Exclusive Discord role'
    ],
    'diamond': [
      'All Platinum benefits',
      'Annual meetup invitation',
      `${levelInfo.discount}% discount on purchases`,
      'Legendary status recognition'
    ],
    'mithril': [
      'All Diamond benefits',
      'Master level privileges',
      `${levelInfo.discount}% discount on purchases`,
      'Ultimate crafting access'
    ],
    'legend': [
      'All Mithril benefits',
      'Ultimate mastery recognition',
      `${levelInfo.discount}% discount on purchases`,
      'Legendary goblin status'
    ]
  };
  
  return tierBenefits[level] || tierBenefits.wood;
}

/**
 * Get tier progression info
 */
function getMaterialProgression(level) {
  const tierNames = TIERS.map(t => t.name);
  const currentIndex = tierNames.indexOf(level);
  const currentTier = TIERS[currentIndex];
  
  return {
    tier: level,
    currentTier: currentTier,
    totalTiers: TIERS.length,
    isMaxTier: currentIndex === TIERS.length - 1,
    isMinTier: currentIndex === 0,
    nextTier: currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null,
    previousTier: currentIndex > 0 ? TIERS[currentIndex - 1] : null
  };
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
 * Get leaderboard (ordered by tier hierarchy)
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
          WHEN userLoyalty.level = 'legend' THEN 1
          WHEN userLoyalty.level = 'mithril' THEN 2
          WHEN userLoyalty.level = 'diamond' THEN 3
          WHEN userLoyalty.level = 'platinum' THEN 4
          WHEN userLoyalty.level = 'gold' THEN 5
          WHEN userLoyalty.level = 'silver' THEN 6
          WHEN userLoyalty.level = 'bronze' THEN 7
          WHEN userLoyalty.level = 'wood' THEN 8
          ELSE 9
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
  TIERS,
  TIER_INFO
};

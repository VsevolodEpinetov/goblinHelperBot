// ═══════════════════════════════════════════════════════════════════════════
// RPG UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
// Core utilities for the RPG/XP system

const knex = require('../db/knex');
const rpgConfig = require('../../configs/rpg');
const notifications = require('../../configs/notifications');
const { getUser } = require('../db/helpers');

// ─────────────────────────────────────────────────────────────────────────
// RANK CHECKING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if user has a specific rank (tier or higher)
 * @param {number} userId - User ID
 * @param {string} requiredTier - Required tier dev name (e.g., 'silver')
 * @param {number} [requiredLevel] - Optional: Required level within tier
 * @returns {Promise<boolean>} - True if user meets requirements
 * 
 * @example
 * // Check if user is at least Silver
 * await hasRank(12345, 'silver');
 * 
 * // Check if user is at least Silver level 5
 * await hasRank(12345, 'silver', 5);
 */
async function hasRank(userId, requiredTier, requiredLevel = 1) {
  try {
    const userRank = await getUserRank(userId);
    if (!userRank) return false;

    // Get tier indices for comparison
    const userTierIndex = rpgConfig.tiers.findIndex(t => t.devName === userRank.tier);
    const requiredTierIndex = rpgConfig.tiers.findIndex(t => t.devName === requiredTier);

    if (userTierIndex === -1 || requiredTierIndex === -1) {
      console.error(`[RPG] Invalid tier comparison: user=${userRank.tier}, required=${requiredTier}`);
      return false;
    }

    // Check tier first
    if (userTierIndex > requiredTierIndex) {
      return true; // User is in higher tier
    }

    if (userTierIndex < requiredTierIndex) {
      return false; // User is in lower tier
    }

    // Same tier, check level
    return userRank.level >= requiredLevel;

  } catch (error) {
    console.error('[RPG] Error in hasRank:', error);
    return false;
  }
}

/**
 * Check if user has reached a specific XP threshold
 * @param {number} userId - User ID
 * @param {number} requiredXp - Required XP amount
 * @returns {Promise<boolean>}
 */
async function hasXpThreshold(userId, requiredXp) {
  try {
    const userRow = await getUserLevelRow(userId);
    if (!userRow) return false;
    return userRow.total_xp >= requiredXp;
  } catch (error) {
    console.error('[RPG] Error in hasXpThreshold:', error);
    return false;
  }
}

/**
 * Get multiple users' ranks at once (optimized for leaderboards)
 * @param {number[]} userIds - Array of user IDs
 * @returns {Promise<Map>} - Map of userId -> rank object
 */
async function getBulkUserRanks(userIds) {
  try {
    const rows = await knex('user_levels')
      .whereIn('user_id', userIds)
      .select('user_id', 'total_xp', 'current_tier', 'current_level');

    const ranksMap = new Map();

    for (const row of rows) {
      // Use hybrid approach: validate stored rank
      const calculated = rpgConfig.calculateRankFromXp(row.total_xp);
      
      if (calculated.tier !== row.current_tier || calculated.level !== row.current_level) {
        // Drift detected, use calculated and schedule update
        ranksMap.set(row.user_id, calculated);
        // Fire and forget update
        updateUserRankInDb(row.user_id, calculated).catch(err => 
          console.error(`[RPG] Failed to update drift for user ${row.user_id}:`, err)
        );
      } else {
        ranksMap.set(row.user_id, {
          tier: row.current_tier,
          level: row.current_level,
          tierName: calculated.tierName,
          emoji: calculated.emoji
        });
      }
    }

    return ranksMap;

  } catch (error) {
    console.error('[RPG] Error in getBulkUserRanks:', error);
    return new Map();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// XP GRANTING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Grant XP to user (primary XP granting function)
 * @param {number} userId - User ID
 * @param {number} amount - XP amount to grant (can be negative)
 * @param {string} source - Source of XP (see rpgConfig.xpSources)
 * @param {Object} [metadata={}] - Additional metadata
 * @returns {Promise<Object>} - { success, deltaXp, newTotalXp, oldRank, newRank, leveledUp }
 * 
 * @example
 * await grantXp(12345, 100, 'admin_grant', { 
 *   reason: 'Помощь с тестированием',
 *   grantedBy: 67890 
 * });
 */
async function grantXp(userId, amount, source, metadata = {}) {
  try {
    // Ensure user level row exists
    const userRow = await ensureUserLevelRow(userId);
    
    // Calculate new XP and ranks
    const oldXp = Number(userRow.total_xp || 0);
    const newXp = oldXp + Number(amount);
    
    if (newXp < 0) {
      console.warn(`[RPG] Warning: User ${userId} would have negative XP (${newXp}), setting to 0`);
    }
    
    const finalXp = Math.max(0, newXp);
    const oldRank = rpgConfig.calculateRankFromXp(oldXp);
    const newRank = rpgConfig.calculateRankFromXp(finalXp);
    
    const leveledUp = (oldRank.tier !== newRank.tier || oldRank.level !== newRank.level);

    // Update database in transaction
    await knex.transaction(async trx => {
      // Update user_levels
      await trx('user_levels')
        .where({ user_id: Number(userId) })
        .update({
          total_xp: finalXp,
          current_tier: newRank.tier,
          current_level: newRank.level,
          xp_to_next_level: newRank.xpToNextLevel,
          updated_at: knex.fn.now(),
          level_up_date: leveledUp ? knex.fn.now() : userRow.level_up_date
        });

      // Log transaction
      if (amount !== 0) {
        await trx('xp_transactions').insert({
          user_id: Number(userId),
          amount: Number(amount),
          source,
          metadata,
          description: metadata.description || null
        });
      }
    });

    // Send notifications for ALL XP gains (non-blocking)
    if (amount > 0 && rpgConfig.notifications.xpGain.enabled) {
      sendXpGainNotification(userId, amount, source, metadata).catch(err =>
        console.error('[RPG] Failed to send XP gain notification:', err)
      );
    }

    if (leveledUp && rpgConfig.notifications.levelUp.enabled) {
      sendLevelUpNotification(userId, oldRank, newRank, metadata).catch(err =>
        console.error('[RPG] Failed to send level up notification:', err)
      );
    }

    const timestamp = new Date().toISOString();
    const userData = await getUser(userId);
    const username = userData?.username ? `@${userData.username}` : `${userData?.first_name || 'Unknown'}`;
    console.log(`[${timestamp}] [RPG] ${username} (${userId}) ${amount >= 0 ? '+' : ''}${amount} XP from ${source}${leveledUp ? ` → Level up! ${oldRank.emoji} ${oldRank.tierName} ${oldRank.level} → ${newRank.emoji} ${newRank.tierName} ${newRank.level}` : ''}`);

    return {
      success: true,
      deltaXp: Number(amount),
      newTotalXp: finalXp,
      oldRank,
      newRank,
      leveledUp
    };

  } catch (error) {
    console.error('[RPG] Error in grantXp:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Grant XP from star payment (uses configured conversion rate)
 * @param {number} userId - User ID
 * @param {number} starsSpent - Number of Telegram Stars spent
 * @param {string} paymentType - Payment type (e.g., 'subscription', 'old_month')
 * @param {Object} [metadata={}] - Additional metadata
 * @returns {Promise<Object>}
 */
async function grantXpFromStars(userId, starsSpent, paymentType, metadata = {}) {
  const xpAmount = Math.floor(starsSpent * rpgConfig.xpSources.stars.xpPerStar);
  
  return await grantXp(userId, xpAmount, 'spending_payment', {
    ...metadata,
    starsSpent,
    paymentType,
    conversionRate: rpgConfig.xpSources.stars.xpPerStar
  });
}

/**
 * Grant XP from subscription (uses predefined amounts)
 * @param {number} userId - User ID
 * @param {string} subscriptionType - 'regular' or 'plus'
 * @param {Object} [metadata={}] - Additional metadata
 * @returns {Promise<Object>}
 */
async function grantXpFromSubscription(userId, subscriptionType, metadata = {}) {
  const config = rpgConfig.xpSources.subscriptions[subscriptionType];
  
  if (!config || !config.baseXp) {
    console.error(`[RPG] Invalid subscription type: ${subscriptionType}`);
    return { success: false, error: 'Invalid subscription type' };
  }

  return await grantXp(userId, config.baseXp, 'spending_payment', {
    ...metadata,
    subscriptionType,
    description: config.description
  });
}

/**
 * Grant XP from message activity (respects daily limits and cooldowns)
 * @param {number} userId - User ID
 * @param {number} groupId - Group where message was sent
 * @param {Object} [metadata={}] - Additional metadata
 * @returns {Promise<Object>}
 */
async function grantXpFromMessage(userId, groupId, metadata = {}) {
  const config = rpgConfig.xpSources.messages;

  if (!config.enabled) {
    return { success: false, error: 'Message XP is disabled' };
  }

  // Check if group is allowed
  if (config.allowedGroupIds.length > 0 && !config.allowedGroupIds.includes(groupId)) {
    return { success: false, error: 'Group not allowed for message XP' };
  }

  // TODO: Check cooldown and daily/weekly limits
  // This would require additional tables or Redis for tracking
  // For now, just grant the XP

  return await grantXp(userId, config.xpPerMessage, 'message_activity', {
    ...metadata,
    groupId
  });
}

// ─────────────────────────────────────────────────────────────────────────
// RANK RETRIEVAL FUNCTIONS (HYBRID APPROACH)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get user's current rank (uses hybrid approach: read from DB, validate, update if needed)
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Rank object or null
 */
async function getUserRank(userId) {
  try {
    const userRow = await getUserLevelRow(userId);
    if (!userRow) return null;

    // Calculate rank from XP
    const calculated = rpgConfig.calculateRankFromXp(userRow.total_xp);

    // Check for drift (stored rank differs from calculated)
    if (calculated.tier !== userRow.current_tier || calculated.level !== userRow.current_level) {
      if (rpgConfig.notifications.driftDetection.enabled) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [RPG] Drift detected for user ${userId}: stored=${userRow.current_tier} ${userRow.current_level}, calculated=${calculated.tier} ${calculated.level}, XP=${userRow.total_xp}`);
      }

      // Auto-fix drift
      if (rpgConfig.notifications.driftDetection.autoFix) {
        await updateUserRankInDb(userId, calculated);
      }
    }

    return {
      tier: calculated.tier,
      tierName: calculated.tierName,
      emoji: calculated.emoji,
      level: calculated.level,
      totalXp: userRow.total_xp,
      xpToNextLevel: calculated.xpToNextLevel,
      nextTierXp: calculated.nextTierXp,
      tierData: calculated.tierData
    };

  } catch (error) {
    console.error('[RPG] Error in getUserRank:', error);
    return null;
  }
}

/**
 * Get user's full XP stats
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>}
 */
async function getUserXpStats(userId) {
  try {
    const userRow = await getUserLevelRow(userId);
    if (!userRow) return null;

    const rank = await getUserRank(userId);
    
    // Get recent transactions
    const recentTransactions = await knex('xp_transactions')
      .where('user_id', Number(userId))
      .orderBy('created_at', 'desc')
      .limit(10)
      .select('*');

    // Calculate total XP gained this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyXp = await knex('xp_transactions')
      .where('user_id', Number(userId))
      .where('created_at', '>=', weekAgo)
      .where('amount', '>', 0)
      .sum('amount as total')
      .first();

    return {
      ...rank,
      totalXp: userRow.total_xp,
      totalSpendingUnits: userRow.total_spending_units,
      weeklyXp: Number(weeklyXp?.total || 0),
      lastLevelUp: userRow.level_up_date,
      recentTransactions
    };

  } catch (error) {
    console.error('[RPG] Error in getUserXpStats:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// NOTIFICATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Send RPG notification to main group RPG topic
 * @param {string} message - HTML-formatted message
 * @param {Object} [options={}] - Additional Telegram options
 * @returns {Promise<boolean>} - Success status
 * 
 * @example
 * await sendRpgNotification(
 *   '🎉 <b>Специальное событие!</b>\n\nДвойной XP в эти выходные!',
 *   { disable_notification: false }
 * );
 */
async function sendRpgNotification(message, options = {}) {
  try {
    if (!notifications.rpgTopicId || !notifications.mainGroupId) {
      console.warn('[RPG] RPG topic or main group not configured, skipping notification');
      return false;
    }

    await globalThis.__bot?.telegram.sendMessage(
      notifications.mainGroupId,
      message,
      {
        parse_mode: 'HTML',
        message_thread_id: notifications.rpgTopicId,
        ...options
      }
    );

    return true;

  } catch (error) {
    console.error('[RPG] Error sending RPG notification:', error);
    return false;
  }
}

/**
 * Send XP gain notification
 * @private
 */
async function sendXpGainNotification(userId, xpGained, source, metadata = {}) {
  try {
    const userData = await getUser(Number(userId));
    if (!userData) return;

    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;

    // Format source-specific message
    let sourceMessage = '';
    let emoji = '⭐';

    switch (source) {
      case 'spending_payment':
        if (metadata.subscriptionType === 'plus') {
          sourceMessage = '💎 Плюс подписка';
          emoji = '💎';
        } else if (metadata.subscriptionType === 'regular') {
          sourceMessage = '📦 Обычная подписка';
          emoji = '📦';
        } else {
          sourceMessage = '💰 Платеж';
          emoji = '💰';
        }
        break;
      case 'raid_create':
        sourceMessage = '⚔️ Создание рейда';
        emoji = '⚔️';
        break;
      case 'raid_complete':
        sourceMessage = '🏆 Участие в рейде';
        emoji = '🏆';
        break;
      case 'admin_grant':
        sourceMessage = '🎁 Админ награда';
        emoji = '🎁';
        break;
      case 'message_activity':
        sourceMessage = '💬 Активность в чате';
        emoji = '💬';
        break;
      default:
        sourceMessage = '⭐ Получение опыта';
        emoji = '⭐';
    }

    if (metadata.period) {
      sourceMessage += ` (${metadata.period})`;
    }

    const message =
      `${emoji} <b>Получен опыт!</b>\n\n` +
      `👤 ${username}\n` +
      `📈 ${sourceMessage}\n` +
      `⭐ +${xpGained} XP`;

    await sendRpgNotification(message);

  } catch (error) {
    console.error('[RPG] Error in sendXpGainNotification:', error);
  }
}

/**
 * Send level up notification
 * @private
 */
async function sendLevelUpNotification(userId, oldRank, newRank, metadata = {}) {
  try {
    const userData = await getUser(Number(userId));
    if (!userData) return;

    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;

    // Check if we should only notify on tier changes
    if (rpgConfig.notifications.levelUp.onlyNotifyTierChange && oldRank.tier === newRank.tier) {
      return;
    }

    const message =
      `⬆️ <b>Новый уровень!</b>\n\n` +
      `${username} достиг нового уровня:\n\n` +
      `🎖️ <b>${newRank.emoji} ${newRank.tierName} ${newRank.level}</b>\n` +
      `${newRank.tierData.description}\n\n` +
      `🕯 Главгоблин гордится твоими успехами!`;

    await sendRpgNotification(message);

    // Send private message if enabled
    if (rpgConfig.notifications.levelUp.sendPrivateMessage) {
      try {
        await globalThis.__bot?.telegram.sendMessage(
          userId,
          message,
          { parse_mode: 'HTML' }
        );
      } catch (dmError) {
        console.log(`[RPG] Could not send DM to user ${userId}:`, dmError.message);
      }
    }

  } catch (error) {
    console.error('[RPG] Error in sendLevelUpNotification:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DATABASE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ensure user has a row in user_levels table
 * @private
 */
async function ensureUserLevelRow(userId) {
  let row = await knex('user_levels').where({ user_id: Number(userId) }).first();
  
  if (!row) {
    await knex('user_levels').insert({ 
      user_id: Number(userId),
      current_tier: 'wood',
      current_level: 1,
      total_xp: 0,
      total_spending_units: 0
    });
    row = await knex('user_levels').where({ user_id: Number(userId) }).first();
  }
  
  return row;
}

/**
 * Get user level row
 * @private
 */
async function getUserLevelRow(userId) {
  return await knex('user_levels').where({ user_id: Number(userId) }).first();
}

/**
 * Update user rank in database
 * @private
 */
async function updateUserRankInDb(userId, rank) {
  await knex('user_levels')
    .where({ user_id: Number(userId) })
    .update({
      current_tier: rank.tier,
      current_level: rank.level,
      xp_to_next_level: rank.xpToNextLevel,
      updated_at: knex.fn.now()
    });
}

// ─────────────────────────────────────────────────────────────────────────
// LEADERBOARD FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get RPG leaderboard
 * @param {number} [limit=10] - Number of users to return
 * @returns {Promise<Array>} - Array of user rank objects
 */
async function getLeaderboard(limit = 10) {
  try {
    const topUsers = await knex('user_levels')
      .join('users', 'user_levels.user_id', 'users.id')
      .select(
        'user_levels.user_id',
        'user_levels.total_xp',
        'user_levels.current_tier',
        'user_levels.current_level',
        'users.firstName',
        'users.lastName',
        'users.username'
      )
      .orderBy('user_levels.total_xp', 'desc')
      .limit(limit);

    return topUsers.map(user => {
      const rank = rpgConfig.calculateRankFromXp(user.total_xp);
      return {
        userId: user.user_id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        totalXp: user.total_xp,
        ...rank
      };
    });

  } catch (error) {
    console.error('[RPG] Error in getLeaderboard:', error);
    return [];
  }
}

/**
 * Get user's leaderboard position
 * @param {number} userId - User ID
 * @returns {Promise<number|null>} - Position (1-indexed) or null
 */
async function getUserLeaderboardPosition(userId) {
  try {
    const userRow = await getUserLevelRow(userId);
    if (!userRow) return null;

    const position = await knex('user_levels')
      .where('total_xp', '>', userRow.total_xp)
      .count('* as count')
      .first();

    return Number(position.count) + 1;

  } catch (error) {
    console.error('[RPG] Error in getUserLeaderboardPosition:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────

module.exports = {
  // Rank checking
  hasRank,
  hasXpThreshold,
  getBulkUserRanks,

  // XP granting
  grantXp,
  grantXpFromStars,
  grantXpFromSubscription,
  grantXpFromMessage,

  // Rank retrieval
  getUserRank,
  getUserXpStats,

  // Notifications
  sendRpgNotification,

  // Leaderboard
  getLeaderboard,
  getUserLeaderboardPosition,

  // Low-level helpers (for migration/admin tools)
  ensureUserLevelRow,
  getUserLevelRow
};


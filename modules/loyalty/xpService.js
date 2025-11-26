const knex = require('../db/knex');
const rpgConfig = require('../../configs/rpg');
const notifications = require('../../configs/notifications');
const benefitsConfig = require('../../configs/benefits');
const { getUser } = require('../db/helpers');
const { sendXpGainNotification, sendLevelUpNotification } = require('./xpNotifications');

// Constants per loyalty.md
const BASE_REGULAR_UNITS = rpgConfig.baseUnits.regular;
const BASE_PLUS_UNITS = rpgConfig.baseUnits.plus;
const KS_PER_BACKING_CAP_UNITS = rpgConfig.baseUnits.ksPerBackingCapUnits;
const XP_A = rpgConfig.xp.A;
const XP_B = rpgConfig.xp.B;

const TIERS = rpgConfig.tiers;

// Tier display information similar to achievements
const TIER_DISPLAY_INFO = {
  'wood': { name: '🪵 Wood', emoji: '🪵', description: 'Начальный уровень' },
  'bronze': { name: '🥉 Bronze', emoji: '🥉', description: 'Базовое мастерство' },
  'silver': { name: '🥈 Silver', emoji: '🥈', description: 'Растущая сила' },
  'gold': { name: '🥇 Gold', emoji: '🥇', description: 'Элитный статус' },
  'platinum': { name: '💎 Platinum', emoji: '💎', description: 'Премиум уровень' },
  'diamond': { name: '💠 Diamond', emoji: '💠', description: 'Легендарный статус' },
  'mithril': { name: '⚔️ Mithril', emoji: '⚔️', description: 'Мастерский уровень' },
  'legend': { name: '👑 Legend', emoji: '👑', description: 'Верховное мастерство' }
};

function getTierDisplayInfo(tier) {
  return TIER_DISPLAY_INFO[tier] || TIER_DISPLAY_INFO.wood;
}

function computeXpFromSpending(totalUnits) {
  if (!totalUnits || totalUnits <= 0) return 0;
  // New formula: 1.3 XP per star spent (simple linear formula)
  return Math.floor(totalUnits * 1.3);
}

function computeDeltaXp(oldUnits, deltaUnits) {
  const sOld = Number(oldUnits || 0);
  const sNew = sOld + Number(deltaUnits || 0);
  const xpOld = computeXpFromSpending(sOld);
  const xpNew = computeXpFromSpending(sNew);
  const deltaXp = xpNew - xpOld;
  
  // Validate result is not NaN
  if (isNaN(deltaXp)) {
    console.error('⚠️ NaN in computeDeltaXp:', { oldUnits, deltaUnits, sOld, sNew, xpOld, xpNew });
    return 0; // Return 0 instead of NaN to prevent cascading errors
  }
  
  return deltaXp;
}

function getTierAndLevel(totalXp) {
  // Ensure totalXp is a valid number
  const xp = Number(totalXp);
  if (isNaN(xp) || xp < 0) {
    // Default to wood tier if invalid XP
    const defaultTier = TIERS[0];
    return { tier: defaultTier.devName, level: 1, nextLevelAt: defaultTier.minXp + (defaultTier.maxXp - defaultTier.minXp + 1) / 10 };
  }

  const tier = TIERS.find(t => xp >= t.minXp && (t.maxXp === null || xp <= t.maxXp)) || TIERS[TIERS.length - 1];
  if (tier.devName === 'legend') {
    // Legend: level is 1 + extra per 10k beyond 160k (arbitrary simple rule)
    const extra = Math.max(0, Math.floor((xp - 160000) / 10000));
    return { tier: 'legend', level: 1 + extra, nextLevelAt: null };
  }
  const span = tier.maxXp - tier.minXp + 1;
  const step = Math.max(1, Math.floor(span / 10)); // Ensure step is at least 1 to avoid division by zero
  const within = Math.max(0, xp - tier.minXp);
  const level = Math.min(10, Math.floor(within / step) + 1);
  const nextLevelAt = Math.min(tier.maxXp, tier.minXp + level * step);
  return { tier: tier.devName, level, nextLevelAt };
}

async function ensureUserLevelRow(userId) {
  let row = await knex('user_levels').where({ user_id: Number(userId) }).first();
  if (!row) {
    await knex('user_levels').insert({ user_id: Number(userId) });
    row = await knex('user_levels').where({ user_id: Number(userId) }).first();
  }
  return row;
}

async function applyXpGain(userId, deltaUnits, source, metadata = {}) {
  // Validate deltaUnits is a valid number
  const deltaUnitsNum = Number(deltaUnits);
  if (isNaN(deltaUnitsNum)) {
    console.error('⚠️ Invalid deltaUnits in applyXpGain:', deltaUnits, 'for user:', userId);
    throw new Error(`Invalid deltaUnits: ${deltaUnits}`);
  }

  const row = await ensureUserLevelRow(userId);
  const newUnits = Number(row.total_spending_units || 0) + deltaUnitsNum;
  const deltaXp = computeDeltaXp(row.total_spending_units, deltaUnitsNum);
  const newTotalXp = Number(row.total_xp || 0) + deltaXp;
  
  // Validate newTotalXp is a valid number before calculating tier/level
  if (isNaN(newTotalXp)) {
    console.error('⚠️ Invalid newTotalXp calculated:', { 
      oldXp: row.total_xp, 
      deltaXp, 
      newTotalXp,
      userId,
      deltaUnits: deltaUnitsNum
    });
    throw new Error(`Invalid newTotalXp calculation: ${newTotalXp}`);
  }
  
  const { tier, level, nextLevelAt } = getTierAndLevel(newTotalXp);

  // Validate tier and level are valid before database update
  if (!tier || isNaN(level) || level < 1) {
    console.error('⚠️ Invalid tier/level calculated:', { 
      tier, 
      level, 
      newTotalXp,
      userId,
      deltaUnits: deltaUnitsNum
    });
    throw new Error(`Invalid tier/level calculation: tier=${tier}, level=${level}`);
  }

  await knex.transaction(async trx => {
    await trx('user_levels')
      .where({ user_id: Number(userId) })
      .update({
        total_spending_units: newUnits,
        total_xp: newTotalXp,
        current_tier: tier,
        current_level: level,
        xp_to_next_level: nextLevelAt ? (nextLevelAt - newTotalXp) : null,
        updated_at: knex.fn.now(),
        level_up_date: (level !== row.current_level || tier !== row.current_tier) ? knex.fn.now() : row.level_up_date
      });

    if (deltaXp !== 0) {
      await trx('xp_transactions').insert({
        user_id: Number(userId),
        amount: deltaXp,
        source,
        metadata,
        description: metadata.description || null
      });
    }
  });

  // Send XP gain notification (always)
  if (deltaXp > 0) {
    try {
      await sendXpGainNotification(Number(userId), deltaXp, source, metadata);
    } catch (error) {
      console.error('Failed to send XP gain notification:', error);
    }
  }

  // Send RPG level up notification to main group with RPG topic
  if (level !== row.current_level || tier !== row.current_tier) {
    try {
      // Get user data for notification
      const userData = await getUser(Number(userId));
      if (userData && notifications.rpgTopicId && notifications.mainGroupId) {
        // Create tagged message for RPG topic
        const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
        const tierInfo = getTierDisplayInfo(tier);
        const rpgMessage = 
          `⬆️ <b>Новый уровень!</b>\n\n` +
          `${username} достиг нового уровня:\n\n` +
          `🎖️ <b>${tierInfo.name} ${level}</b>\n` +
          `${tierInfo.description}\n\n` +
          `🕯 Главгоблин гордится твоими успехами!`;
        
        await globalThis.__bot?.telegram.sendMessage(
          notifications.mainGroupId,
          rpgMessage, 
          { 
            parse_mode: 'HTML',
            message_thread_id: notifications.rpgTopicId
          }
        );
      }
    } catch (error) {
      console.error('Failed to send RPG level up notification:', error);
    }
  }

  return { deltaXp, newTotalXp, tier, level };
}

function getSubscriptionBaseUnits(subscriptionType) {
  return subscriptionType === 'plus' ? BASE_PLUS_UNITS : BASE_REGULAR_UNITS;
}

module.exports = {
  computeXpFromSpending,
  computeDeltaXp,
  getTierAndLevel,
  applyXpGain,
  getSubscriptionBaseUnits,
  applyDirectXp: async function applyDirectXp(userId, deltaXp, source, metadata = {}) {
    const row = await ensureUserLevelRow(userId);
    const newTotalXp = Number(row.total_xp || 0) + Number(deltaXp || 0);
    const { tier, level, nextLevelAt } = getTierAndLevel(newTotalXp);

    await knex.transaction(async trx => {
      await trx('user_levels')
        .where({ user_id: Number(userId) })
        .update({
          total_xp: newTotalXp,
          current_tier: tier,
          current_level: level,
          xp_to_next_level: nextLevelAt ? (nextLevelAt - newTotalXp) : null,
          updated_at: knex.fn.now(),
          level_up_date: (level !== row.current_level || tier !== row.current_tier) ? knex.fn.now() : row.level_up_date
        });

      if (deltaXp !== 0) {
        await trx('xp_transactions').insert({
          user_id: Number(userId),
          amount: Number(deltaXp),
          source,
          metadata,
          description: metadata.description || null
        });
      }
    });

    // Send XP gain notification (always)
    if (deltaXp > 0) {
      try {
        await sendXpGainNotification(Number(userId), deltaXp, source, metadata);
      } catch (error) {
        console.error('Failed to send XP gain notification:', error);
      }
    }

    // Send RPG level up notification to main group with RPG topic
    if (level !== row.current_level || tier !== row.current_tier) {
      try {
        // Get user data for notification
        const userData = await getUser(Number(userId));
        if (userData && notifications.rpgTopicId && notifications.mainGroupId) {
          // Create tagged message for RPG topic
          const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
          const tierInfo = getTierDisplayInfo(tier);
          const rpgMessage = 
            `⬆️ <b>Новый уровень!</b>\n\n` +
            `${username} достиг нового уровня:\n\n` +
            `🎖️ <b>${tierInfo.name} ${level}</b>\n` +
            `${tierInfo.description}\n\n` +
            `🕯 Главгоблин гордится твоими успехами!`;
          
          await globalThis.__bot?.telegram.sendMessage(
            notifications.mainGroupId,
            rpgMessage, 
            { 
              parse_mode: 'HTML',
              message_thread_id: notifications.rpgTopicId
            }
          );
        }
      } catch (error) {
        console.error('Failed to send RPG level up notification:', error);
      }
    }

    return { deltaXp: Number(deltaXp), newTotalXp, tier, level };
  },
  ensureUserLevelRow,
  constants: {
    BASE_REGULAR_UNITS,
    BASE_PLUS_UNITS,
    KS_PER_BACKING_CAP_UNITS,
    XP_A,
    XP_B
  }
};



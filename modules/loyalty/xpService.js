const knex = require('../db/knex');
const rpgConfig = require('../../configs/rpg');
const notifications = require('../../configs/notifications');
const benefitsConfig = require('../../configs/benefits');

// Constants per loyalty.md
const BASE_REGULAR_UNITS = rpgConfig.baseUnits.regular;
const BASE_PLUS_UNITS = rpgConfig.baseUnits.plus;
const KS_PER_BACKING_CAP_UNITS = rpgConfig.baseUnits.ksPerBackingCapUnits;
const XP_A = rpgConfig.xp.A;
const XP_B = rpgConfig.xp.B;

const TIERS = rpgConfig.tiers;

function computeXpFromSpending(totalUnits) {
  if (!totalUnits || totalUnits <= 0) return 0;
  return Math.floor(XP_A * Math.pow(totalUnits, XP_B));
}

function computeDeltaXp(oldUnits, deltaUnits) {
  const sOld = Number(oldUnits || 0);
  const sNew = sOld + Number(deltaUnits || 0);
  const xpOld = computeXpFromSpending(sOld);
  const xpNew = computeXpFromSpending(sNew);
  return xpNew - xpOld;
}

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

async function ensureUserLevelRow(userId) {
  let row = await knex('user_levels').where({ user_id: Number(userId) }).first();
  if (!row) {
    await knex('user_levels').insert({ user_id: Number(userId) });
    row = await knex('user_levels').where({ user_id: Number(userId) }).first();
  }
  return row;
}

async function applyXpGain(userId, deltaUnits, source, metadata = {}) {
  const row = await ensureUserLevelRow(userId);
  const newUnits = Number(row.total_spending_units || 0) + Number(deltaUnits || 0);
  const deltaXp = computeDeltaXp(row.total_spending_units, deltaUnits);
  const newTotalXp = Number(row.total_xp || 0) + deltaXp;
  const { tier, level, nextLevelAt } = getTierAndLevel(newTotalXp);

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

  // Notify RPG topic on level up
  try {
    const topicId = notifications.rpgTopicId;
    if (topicId && (level !== row.current_level || tier !== row.current_tier)) {
      await globalThis.__bot?.telegram.sendMessage(topicId, `⬆️ Пользователь ${userId} повысил уровень: ${tier.toUpperCase()} ${level}`);
    }
  } catch {}

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



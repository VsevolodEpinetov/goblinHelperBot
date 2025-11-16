// ═══════════════════════════════════════════════════════════════════════════
// RPG (EXPERIENCE) SYSTEM CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
// This is the single source of truth for all RPG/XP mechanics

// ─────────────────────────────────────────────────────────────────────────
// TIER/RANK DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────
// Each tier has:
// - devName: Internal identifier
// - displayName: User-facing name (with emoji)
// - emoji: Tier icon
// - minXp: Minimum XP to reach this tier
// - maxXp: Maximum XP in this tier (null = unlimited)
// - levels: Number of sub-levels within tier
// - description: Flavor text
// - benefits: Array of benefit strings (can be used in UI)

const tiers = [
  {
    devName: 'wood',
    displayName: 'Деревянный',
    emoji: '🪵',
    minXp: 0,
    maxXp: 1999,
    levels: 10,
    description: 'Начало пути. Ты только учишься мастерству.',
    benefits: [
      'Базовый доступ к контенту',
      'Участие в опросах',
      'Базовая поддержка'
    ],
    discount: 0
  },
  {
    devName: 'bronze',
    displayName: 'Бронзовый',
    emoji: '🥉',
    minXp: 2000,
    maxXp: 4999,
    levels: 10,
    description: 'Базовое мастерство. Твои навыки растут.',
    benefits: [
      'Все преимущества Деревянного',
      'Приоритетная поддержка',
      'Доступ к эксклюзивному контенту',
      '5% скидка на покупки'
    ],
    discount: 5
  },
  {
    devName: 'silver',
    displayName: 'Серебряный',
    emoji: '🥈',
    minXp: 5000,
    maxXp: 9999,
    levels: 10,
    description: 'Растущая сила. Ты становишься заметным.',
    benefits: [
      'Все преимущества Бронзового',
      'Ранний доступ к новинкам',
      'Возможность создавать опросы',
      '10% скидка на покупки',
      'Кастомный бейдж профиля'
    ],
    discount: 10
  },
  {
    devName: 'gold',
    displayName: 'Золотой',
    emoji: '🥇',
    minXp: 10000,
    maxXp: 19999,
    levels: 10,
    description: 'Элитный статус. Ты среди лучших.',
    benefits: [
      'Все преимущества Серебряного',
      'VIP канал поддержки',
      'Доступ к бета-тестированию',
      '15% скидка на покупки',
      'Предложение новых функций'
    ],
    discount: 15
  },
  {
    devName: 'platinum',
    displayName: 'Платиновый',
    emoji: '💎',
    minXp: 20000,
    maxXp: 39999,
    levels: 10,
    description: 'Премиум уровень. Ты настоящий мастер.',
    benefits: [
      'Все преимущества Золотого',
      'Личный контакт с админом',
      '20% скидка на покупки',
      'Эксклюзивная роль в Discord'
    ],
    discount: 20
  },
  {
    devName: 'diamond',
    displayName: 'Алмазный',
    emoji: '💠',
    minXp: 40000,
    maxXp: 79999,
    levels: 10,
    description: 'Легендарный статус. Твоё имя известно всем.',
    benefits: [
      'Все преимущества Платинового',
      'Приглашение на ежегодную встречу',
      '25% скидка на покупки',
      'Признание легендарного статуса'
    ],
    discount: 25
  },
  {
    devName: 'mithril',
    displayName: 'Мифриловый',
    emoji: '⚔️',
    minXp: 80000,
    maxXp: 159999,
    levels: 10,
    description: 'Мастерский уровень. Ты легенда среди гоблинов.',
    benefits: [
      'Все преимущества Алмазного',
      'Привилегии мастерского уровня',
      '30% скидка на покупки',
      'Доступ к секретным проектам'
    ],
    discount: 30
  },
  {
    devName: 'legend',
    displayName: 'Легендарный',
    emoji: '👑',
    minXp: 160000,
    maxXp: null, // Unlimited
    levels: null, // Unlimited levels (1 + extra per 10k XP)
    levelStep: 10000, // Each 10k XP = +1 level
    description: 'Верховное мастерство. Ты - истинная легенда.',
    benefits: [
      'Все преимущества Мифрилового',
      'Признание высшего мастерства',
      '35% скидка на покупки',
      'Статус легендарного гоблина',
      'Бесконечное развитие'
    ],
    discount: 35
  }
];

// ─────────────────────────────────────────────────────────────────────────
// XP SOURCES & COEFFICIENTS
// ─────────────────────────────────────────────────────────────────────────

const xpSources = {
  // ─── PAYMENT-BASED XP ───
  stars: {
    enabled: true,
    xpPerStar: 5, // How much XP per 1 Telegram Star spent
    description: 'XP за потраченные звезды Telegram',
    // Legacy support: use spending units formula if needed
    useLegacyFormula: true,
    legacyFormula: {
      A: 173.8,
      B: 0.393,
      // Base units for subscription types
      regularUnits: 600,
      plusUnits: 1600,
      kickstarterUnits: 300
    }
  },

  // ─── SUBSCRIPTION PAYMENTS ───
  subscriptions: {
    enabled: true,
    regular: {
      baseXp: 600, // Flat XP for regular subscription
      description: 'Обычная подписка'
    },
    plus: {
      baseXp: 1600, // Flat XP for plus subscription
      description: 'Плюс подписка'
    }
  },

  // ─── ACTIVITY-BASED XP ───
  messages: {
    enabled: true,
    xpPerMessage: 1, // XP gained per message
    cooldownMinutes: 1, // Minimum time between XP-earning messages
    dailyLimit: 7, // Max XP from messages per day
    weeklyLimit: 52, // Max XP from messages per week
    description: 'Активность в чатах',
    // Only count messages in specific groups
    allowedGroupIds: process.env.MAIN_GROUP_ID ? [Number(process.env.MAIN_GROUP_ID)] : []
  },

  // ─── RAIDS ───
  raids: {
    enabled: true,
    createRaid: 50, // XP for creating a raid
    completeRaid: 100, // XP for completing a raid
    joinRaid: 25, // XP for joining a raid
    description: 'Участие в рейдах'
  },

  // ─── ACHIEVEMENTS ───
  achievements: {
    enabled: true,
    // XP bonuses are defined per achievement
    description: 'Разблокировка достижений'
  },

  // ─── ADMIN GRANTS ───
  adminGrant: {
    enabled: true,
    description: 'Награда от администратора'
  },

  // ─── KICKSTARTER BACKING ───
  kickstarter: {
    enabled: true,
    xpPerBackingCap: 300, // XP per backing cap unit
    description: 'Поддержка Kickstarter проектов'
  },

  // ─── OLD MONTH ACCESS ───
  oldMonth: {
    enabled: true,
    baseXp: 300, // XP for purchasing old month access
    description: 'Покупка доступа к старым месяцам'
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PRICING (Stars)
// ─────────────────────────────────────────────────────────────────────────

const prices = {
  regularStars: process.env.REGULAR_PRICE ? Number(process.env.REGULAR_PRICE) : 350,
  plusStars: process.env.PLUS_PRICE ? Number(process.env.PLUS_PRICE) : 1000,
  oldMonthStars: process.env.OLD_MONTH_PRICE ? Number(process.env.OLD_MONTH_PRICE) : 200
};

// ─────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────

const notifications = {
  // XP gain notifications
  xpGain: {
    enabled: true,
    minXpToNotify: 10, // Only notify if XP gain >= this amount
    sendToRpgTopic: true,
    sendPrivateMessage: false // Could send DM to user
  },

  // Level up notifications
  levelUp: {
    enabled: true,
    sendToRpgTopic: true,
    sendPrivateMessage: true, // Notify user privately
    onlyNotifyTierChange: false // Notify on every level, not just tier changes
  },

  // Rank calculation drift detection
  driftDetection: {
    enabled: true,
    logDrift: true, // Log when stored rank differs from calculated
    autoFix: true // Automatically fix drift on detection
  }
};

// ─────────────────────────────────────────────────────────────────────────
// CALCULATION METHOD
// ─────────────────────────────────────────────────────────────────────────

const calculationMethod = {
  // Strategy: 'pure_calculation' | 'hybrid' | 'pure_storage'
  strategy: 'hybrid',
  
  // Hybrid options
  validateOnRead: true, // Recalculate and fix drift on every read
  logInconsistencies: true, // Log when drift is detected
  
  // Cache settings (optional future enhancement)
  cacheRanks: false,
  cacheTTLSeconds: 300
};

// ─────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get tier by XP amount
 * @param {number} xp - Total XP
 * @returns {Object} Tier object
 */
function getTierByXp(xp) {
  for (const tier of tiers) {
    if (xp >= tier.minXp && (tier.maxXp === null || xp <= tier.maxXp)) {
      return tier;
    }
  }
  // Default to wood if somehow not found
  return tiers[0];
}

/**
 * Get tier by dev name
 * @param {string} devName - Tier dev name
 * @returns {Object} Tier object or null
 */
function getTierByName(devName) {
  return tiers.find(t => t.devName === devName) || null;
}

/**
 * Calculate level within tier
 * @param {number} xp - Total XP
 * @param {Object} tier - Tier object
 * @returns {Object} { level, xpIntoLevel, xpNeededForNext }
 */
function calculateLevelInTier(xp, tier) {
  if (tier.devName === 'legend') {
    // Legend: infinite levels
    const extra = Math.max(0, xp - tier.minXp);
    const level = 1 + Math.floor(extra / tier.levelStep);
    const xpIntoLevel = extra % tier.levelStep;
    const xpNeededForNext = tier.levelStep - xpIntoLevel;
    return { level, xpIntoLevel, xpNeededForNext };
  }

  // Regular tiers: fixed levels
  const xpRange = tier.maxXp - tier.minXp + 1;
  const xpPerLevel = xpRange / tier.levels;
  const xpIntoTier = Math.max(0, xp - tier.minXp);
  const level = Math.min(tier.levels, Math.floor(xpIntoTier / xpPerLevel) + 1);
  const xpIntoLevel = xpIntoTier % xpPerLevel;
  const xpNeededForNext = level === tier.levels ? 
    (tier.maxXp - xp) : // Last level: XP until next tier
    (xpPerLevel - xpIntoLevel);

  return { level, xpIntoLevel, xpNeededForNext };
}

/**
 * Get next tier
 * @param {string} currentTierName - Current tier dev name
 * @returns {Object|null} Next tier object or null
 */
function getNextTier(currentTierName) {
  const currentIndex = tiers.findIndex(t => t.devName === currentTierName);
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }
  return tiers[currentIndex + 1];
}

/**
 * Calculate rank from XP (for hybrid approach)
 * @param {number} xp - Total XP
 * @returns {Object} { tier, tierName, level, xpToNextLevel, nextTierXp }
 */
function calculateRankFromXp(xp) {
  const tier = getTierByXp(xp);
  const { level, xpNeededForNext } = calculateLevelInTier(xp, tier);
  const nextTier = getNextTier(tier.devName);

  return {
    tier: tier.devName,
    tierName: tier.displayName,
    emoji: tier.emoji,
    level,
    xpToNextLevel: xpNeededForNext,
    nextTierXp: nextTier ? nextTier.minXp : null,
    tierData: tier
  };
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core data
  tiers,
  xpSources,
  prices,
  notifications,
  calculationMethod,

  // Legacy compatibility
  baseUnits: xpSources.stars.legacyFormula,
  xp: {
    A: xpSources.stars.legacyFormula.A,
    B: xpSources.stars.legacyFormula.B
  },

  // Helper functions
  getTierByXp,
  getTierByName,
  calculateLevelInTier,
  calculateRankFromXp,
  getNextTier
};

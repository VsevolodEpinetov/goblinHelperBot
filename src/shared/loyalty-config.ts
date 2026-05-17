export interface Tier {
  /** Stable identifier used across the codebase (was `devName` in the JS config). */
  name: string;
  /** User-facing display name in Russian. */
  displayName: string;
  /** Emoji shown next to the tier. */
  emoji: string;
  /** Inclusive lower XP boundary. */
  xpMin: number;
  /** Inclusive upper XP boundary, or null for the top tier. */
  xpMax: number | null;
  /** Number of sub-levels within the tier (null for the open-ended top tier). */
  levels: number | null;
  /** XP per level for the open-ended top tier only. */
  levelStep?: number;
  /** Flavor text shown in profile screens. */
  description: string;
  /** User-facing benefit strings shown in profile/help. */
  benefits: readonly string[];
  /** Discount applied at this tier (0–100). */
  discountPercent: number;
}

/**
 * Canonical tier list — single source of truth for the rewrite.
 * Ported from configs/rpg.js. Manual overrides via the deprecated
 * userLoyalty table are removed in the rewrite.
 */
export const TIERS: readonly Tier[] = [
  {
    name: 'wood',
    displayName: 'Деревянный',
    emoji: '🪵',
    xpMin: 0,
    xpMax: 1999,
    levels: 10,
    description: 'Начало пути. Ты только учишься мастерству.',
    benefits: ['Базовый доступ к контенту', 'Участие в опросах', 'Базовая поддержка'],
    discountPercent: 0,
  },
  {
    name: 'bronze',
    displayName: 'Бронзовый',
    emoji: '🥉',
    xpMin: 2000,
    xpMax: 4999,
    levels: 10,
    description: 'Базовое мастерство. Твои навыки растут.',
    benefits: [
      'Все преимущества Деревянного',
      'Приоритетная поддержка',
      'Доступ к эксклюзивному контенту',
      '5% скидка на покупки',
    ],
    discountPercent: 5,
  },
  {
    name: 'silver',
    displayName: 'Серебряный',
    emoji: '🥈',
    xpMin: 5000,
    xpMax: 9999,
    levels: 10,
    description: 'Растущая сила. Ты становишься заметным.',
    benefits: [
      'Все преимущества Бронзового',
      'Ранний доступ к новинкам',
      'Возможность создавать опросы',
      '10% скидка на покупки',
      'Кастомный бейдж профиля',
    ],
    discountPercent: 10,
  },
  {
    name: 'gold',
    displayName: 'Золотой',
    emoji: '🥇',
    xpMin: 10000,
    xpMax: 19999,
    levels: 10,
    description: 'Элитный статус. Ты среди лучших.',
    benefits: [
      'Все преимущества Серебряного',
      'VIP канал поддержки',
      'Доступ к бета-тестированию',
      '15% скидка на покупки',
      'Предложение новых функций',
    ],
    discountPercent: 15,
  },
  {
    name: 'platinum',
    displayName: 'Платиновый',
    emoji: '💎',
    xpMin: 20000,
    xpMax: 39999,
    levels: 10,
    description: 'Премиум уровень. Ты настоящий мастер.',
    benefits: [
      'Все преимущества Золотого',
      'Личный контакт с админом',
      '20% скидка на покупки',
      'Эксклюзивная роль в Discord',
    ],
    discountPercent: 20,
  },
  {
    name: 'diamond',
    displayName: 'Алмазный',
    emoji: '💠',
    xpMin: 40000,
    xpMax: 79999,
    levels: 10,
    description: 'Легендарный статус. Твоё имя известно всем.',
    benefits: [
      'Все преимущества Платинового',
      'Приглашение на ежегодную встречу',
      '25% скидка на покупки',
      'Признание легендарного статуса',
    ],
    discountPercent: 25,
  },
  {
    name: 'mithril',
    displayName: 'Мифриловый',
    emoji: '⚔️',
    xpMin: 80000,
    xpMax: 159999,
    levels: 10,
    description: 'Мастерский уровень. Ты легенда среди гоблинов.',
    benefits: [
      'Все преимущества Алмазного',
      'Привилегии мастерского уровня',
      '30% скидка на покупки',
      'Доступ к секретным проектам',
    ],
    discountPercent: 30,
  },
  {
    name: 'legend',
    displayName: 'Легендарный',
    emoji: '👑',
    xpMin: 160000,
    xpMax: null,
    levels: null,
    levelStep: 10000,
    description: 'Верховное мастерство. Ты - истинная легенда.',
    benefits: [
      'Все преимущества Мифрилового',
      'Признание высшего мастерства',
      '35% скидка на покупки',
      'Статус легендарного гоблина',
      'Бесконечное развитие',
    ],
    discountPercent: 35,
  },
] as const;

export function getTierByXp(xp: number): Tier {
  const clamped = Math.max(0, xp);
  let current: Tier = TIERS[0]!;
  for (const tier of TIERS) {
    if (clamped >= tier.xpMin) current = tier;
    else break;
  }
  return current;
}

export function tierByName(name: string): Tier | undefined {
  return TIERS.find((t) => t.name === name);
}

export function getNextTier(currentName: string): Tier | null {
  const idx = TIERS.findIndex((t) => t.name === currentName);
  if (idx < 0 || idx === TIERS.length - 1) return null;
  return TIERS[idx + 1]!;
}

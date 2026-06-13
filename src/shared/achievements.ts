export const ACHIEVEMENT_KEYS = ['sbp_payment', 'years_of_service'] as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

interface AchievementDefinition {
  displayName: string;
  description: string;
}

export const ACHIEVEMENTS: Record<AchievementKey, AchievementDefinition> = {
  sbp_payment: {
    displayName: 'Знаток людских банков',
    description:
      'Право платить через СБП/перевод с подтверждением скриншотом. Назначается админом вручную.',
  },
  years_of_service: {
    displayName: 'Старожил',
    description: 'Постоянный участник; даёт 50% скидку на подписку.',
  },
};

export function isKnownAchievement(key: string): key is AchievementKey {
  return (ACHIEVEMENT_KEYS as readonly string[]).includes(key);
}

export function canPayViaSbp(userAchievements: readonly string[]): boolean {
  return userAchievements.includes('sbp_payment');
}

export function hasYearsOfService(userAchievements: readonly string[]): boolean {
  return userAchievements.includes('years_of_service');
}

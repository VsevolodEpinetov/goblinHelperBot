import { db } from '../../db/client';
import { ACHIEVEMENTS, isKnownAchievement } from '../../shared/achievements';
import type { AchievementKey } from '../../shared/achievements';

import { hasAchievement, insertAchievement, listForUser } from './repo';

export interface GrantAchievementInput {
  userId: number;
  type: AchievementKey;
  data?: unknown;
}

export interface GrantAchievementResult {
  applied: boolean;
  alreadyHad: boolean;
}

/** Idempotent. The `user_achievements` UNIQUE constraint structurally prevents duplicates. */
export async function grantAchievement(
  input: GrantAchievementInput,
): Promise<GrantAchievementResult> {
  if (!isKnownAchievement(input.type)) {
    throw new Error(`Unknown achievement type: ${input.type}`);
  }
  const inserted = await insertAchievement(db, input.userId, input.type, input.data);
  return { applied: inserted, alreadyHad: !inserted };
}

export async function userHasAchievement(userId: number, type: AchievementKey): Promise<boolean> {
  return hasAchievement(db, userId, type);
}

export async function getUserAchievements(
  userId: number,
): Promise<Array<{ type: string; displayName: string; description: string; unlockedAt: Date }>> {
  const rows = await listForUser(db, userId);
  return rows
    .filter((r) => isKnownAchievement(r.achievementType))
    .map((r) => {
      const def = ACHIEVEMENTS[r.achievementType as AchievementKey];
      return {
        type: r.achievementType,
        displayName: def.displayName,
        description: def.description,
        unlockedAt: r.unlockedAt,
      };
    });
}

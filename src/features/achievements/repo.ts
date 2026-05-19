import type { DbConn } from '../../db/client';

const UNIQUE_VIOLATION = '23505';

export interface AchievementRow {
  id: number;
  userId: number;
  achievementType: string;
  data: unknown;
  unlockedAt: Date;
  isPublic: boolean;
}

export async function listForUser(conn: DbConn, userId: number): Promise<AchievementRow[]> {
  const rows = await conn('user_achievements')
    .where('user_id', userId)
    .orderBy('unlocked_at', 'desc');
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    userId: r.user_id as number,
    achievementType: r.achievement_type as string,
    data: r.achievement_data,
    unlockedAt: r.unlocked_at as Date,
    isPublic: r.is_public as boolean,
  }));
}

/** Returns true if a new row was inserted; false if (user, type) already existed. */
export async function insertAchievement(
  conn: DbConn,
  userId: number,
  achievementType: string,
  data?: unknown,
): Promise<boolean> {
  try {
    await conn('user_achievements').insert({
      user_id: userId,
      achievement_type: achievementType,
      achievement_data: data ? JSON.stringify(data) : null,
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) return false;
    throw err;
  }
}

export async function hasAchievement(
  conn: DbConn,
  userId: number,
  achievementType: string,
): Promise<boolean> {
  const row = await conn('user_achievements')
    .where({ user_id: userId, achievement_type: achievementType })
    .first('id');
  return !!row;
}

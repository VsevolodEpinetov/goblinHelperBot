import type { DbConn } from '../../db/client';

export interface UserLevelRow {
  userId: number;
  currentTier: string;
  currentLevel: number;
  totalXp: number;
  totalSpendingUnits: number;
  xpToNextLevel: number | null;
  levelUpDate: Date | null;
  updatedAt: Date;
}

export interface XpTransactionRow {
  id: number;
  userId: number;
  amount: number;
  source: string;
  externalId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
}

function rowToUserLevel(row: Record<string, unknown> | undefined): UserLevelRow | undefined {
  if (!row) return undefined;
  return {
    userId: row.user_id as number,
    currentTier: row.current_tier as string,
    currentLevel: row.current_level as number,
    totalXp: row.total_xp as number,
    totalSpendingUnits: Number(row.total_spending_units),
    xpToNextLevel: (row.xp_to_next_level as number | null) ?? null,
    levelUpDate: (row.level_up_date as Date | null) ?? null,
    updatedAt: row.updated_at as Date,
  };
}

export async function getUserLevel(
  conn: DbConn,
  userId: number,
): Promise<UserLevelRow | undefined> {
  const row = await conn('user_levels').where('user_id', userId).first();
  return rowToUserLevel(row);
}

export async function upsertUserLevel(
  conn: DbConn,
  data: {
    userId: number;
    currentTier: string;
    currentLevel: number;
    totalXp: number;
    totalSpendingUnits?: number;
    xpToNextLevel?: number | null;
    levelUpDate?: Date | null;
  },
): Promise<void> {
  await conn('user_levels')
    .insert({
      user_id: data.userId,
      current_tier: data.currentTier,
      current_level: data.currentLevel,
      total_xp: data.totalXp,
      total_spending_units: data.totalSpendingUnits ?? 0,
      xp_to_next_level: data.xpToNextLevel ?? null,
      level_up_date: data.levelUpDate ?? null,
      updated_at: conn.fn.now(),
    })
    .onConflict('user_id')
    .merge({
      current_tier: data.currentTier,
      current_level: data.currentLevel,
      total_xp: data.totalXp,
      xp_to_next_level: data.xpToNextLevel ?? null,
      level_up_date: data.levelUpDate ?? null,
      updated_at: conn.fn.now(),
    });
}

export interface InsertXpInput {
  userId: number;
  amount: number;
  source: string;
  externalId?: string | null;
  description?: string;
  metadata?: unknown;
}

/** Returns true if the row was inserted; false if a UNIQUE(source, external_id) collision occurred. */
export async function insertXpTransaction(conn: DbConn, input: InsertXpInput): Promise<boolean> {
  try {
    await conn('xp_transactions').insert({
      user_id: input.userId,
      amount: input.amount,
      source: input.source,
      external_id: input.externalId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return false;
    throw err;
  }
}

export interface LeaderboardEntry {
  userId: number;
  totalXp: number;
  currentTier: string;
  currentLevel: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export async function getLeaderboard(conn: DbConn, limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await conn('user_levels as l')
    .leftJoin('users as u', 'u.id', 'l.user_id')
    .select(
      'l.user_id',
      'l.total_xp',
      'l.current_tier',
      'l.current_level',
      'u.username',
      'u.first_name',
      'u.last_name',
    )
    .orderBy('l.total_xp', 'desc')
    .limit(limit);

  return rows.map((r: Record<string, unknown>) => ({
    userId: r.user_id as number,
    totalXp: r.total_xp as number,
    currentTier: r.current_tier as string,
    currentLevel: r.current_level as number,
    username: (r.username as string | null) ?? null,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
  }));
}

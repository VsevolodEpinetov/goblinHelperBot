import type { DbConn } from '../../db/client';

export type SubscriptionTier = 'regular' | 'plus';

export interface UserSubscriptionStatus {
  period: string;
  hasRegular: boolean;
  hasPlus: boolean;
}

export async function getSubscriptionStatus(
  conn: DbConn,
  userId: number,
  period: string,
): Promise<UserSubscriptionStatus> {
  const rows = await conn('user_groups').where({ user_id: userId, period }).select('type');
  const types = new Set<string>(rows.map((r: { type: string }) => r.type));
  return {
    period,
    hasRegular: types.has('regular'),
    hasPlus: types.has('plus'),
  };
}

export async function listUserSubscriptions(
  conn: DbConn,
  userId: number,
): Promise<Array<{ period: string; tier: SubscriptionTier }>> {
  const rows = await conn('user_groups')
    .where('user_id', userId)
    .orderBy('period', 'desc')
    .select('period', 'type');
  return rows.map((r: { period: string; type: SubscriptionTier }) => ({
    period: r.period,
    tier: r.type,
  }));
}

export async function getMonthChatId(
  conn: DbConn,
  period: string,
  tier: SubscriptionTier,
): Promise<string | null> {
  const row = await conn('months').where({ period, type: tier }).first('chat_id');
  return row?.chat_id ?? null;
}

/** Past periods that have content (a bound chat), newest first — buyable archives. */
export async function listPurchasablePastPeriods(
  conn: DbConn,
  currentPeriod: string,
  limit = 24,
): Promise<string[]> {
  const rows = await conn('months')
    .whereNotNull('chat_id')
    .andWhere('period', '<', currentPeriod)
    .distinct('period')
    .orderBy('period', 'desc')
    .limit(limit);
  return rows.map((r: { period: string }) => r.period);
}

/** Tiers that actually have content (a bound chat) for a given period. */
export async function listAvailableTiers(
  conn: DbConn,
  period: string,
): Promise<SubscriptionTier[]> {
  const rows = await conn('months').where('period', period).whereNotNull('chat_id').select('type');
  return rows.map((r: { type: SubscriptionTier }) => r.type);
}

import type { DbConn } from '../../db/client';

export interface UserSearchResult {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

/** Search by exact id, exact @username, or username substring. */
export async function searchUsers(
  conn: DbConn,
  query: string,
  limit = 20,
): Promise<UserSearchResult[]> {
  const trimmed = query.trim().replace(/^@/, '');
  let q = conn('users').orderBy('created_at', 'desc').limit(limit);
  const asId = Number(trimmed);
  if (!Number.isNaN(asId) && trimmed === String(asId)) {
    q = q.where('id', asId);
  } else {
    q = q.where('username', 'ilike', `%${trimmed}%`);
  }
  const rows = await q;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    username: (r.username as string | null) ?? null,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    createdAt: r.created_at as Date,
  }));
}

export async function getUserBalance(conn: DbConn, userId: number): Promise<number> {
  const row = await conn('user_purchases').where('user_id', userId).first();
  return row ? Number(row.balance) : 0;
}

export async function setUserBalance(conn: DbConn, userId: number, balance: number): Promise<void> {
  await conn('user_purchases')
    .insert({ user_id: userId, balance })
    .onConflict('user_id')
    .merge({ balance });
}

export interface MonthSummary {
  id: number;
  period: string;
  type: string;
  chatId: string | null;
  counterJoined: number;
  counterPaid: number;
}

export async function listMonths(conn: DbConn, limit = 30): Promise<MonthSummary[]> {
  const rows = await conn('months').orderBy('period', 'desc').limit(limit);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    period: r.period as string,
    type: r.type as string,
    chatId: (r.chat_id as string | null) ?? null,
    counterJoined: (r.counter_joined as number) ?? 0,
    counterPaid: (r.counter_paid as number) ?? 0,
  }));
}

export async function insertMonth(
  conn: DbConn,
  period: string,
  type: 'regular' | 'plus',
  chatId: string | null,
): Promise<void> {
  await conn('months')
    .insert({ period, type, chat_id: chatId, counter_joined: 0, counter_paid: 0 })
    .onConflict(['period', 'type'])
    .merge({ chat_id: chatId });
}

export async function updateMonthChatId(
  conn: DbConn,
  period: string,
  type: 'regular' | 'plus',
  chatId: string,
): Promise<void> {
  await conn('months').where({ period, type }).update({ chat_id: chatId });
}

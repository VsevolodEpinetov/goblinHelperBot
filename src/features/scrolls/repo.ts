import type { DbConn } from '../../db/client';

export interface ScrollBalance {
  scrollId: string;
  amount: number;
}

export async function getUserScrolls(conn: DbConn, userId: number): Promise<ScrollBalance[]> {
  const rows = await conn('user_scrolls')
    .where('user_id', userId)
    .where('amount', '>', 0)
    .select('scroll_id', 'amount');
  return rows.map((r: { scroll_id: string; amount: number }) => ({
    scrollId: r.scroll_id,
    amount: r.amount,
  }));
}

export async function getScrollBalance(
  conn: DbConn,
  userId: number,
  scrollId: string,
): Promise<number> {
  const row = await conn('user_scrolls')
    .where({ user_id: userId, scroll_id: scrollId })
    .select('amount')
    .first();
  return row?.amount ?? 0;
}

export async function adjustScrollAmount(
  conn: DbConn,
  userId: number,
  scrollId: string,
  delta: number,
): Promise<number> {
  // Upsert + atomic increment of `amount`.
  const result = await conn.raw(
    `
    INSERT INTO user_scrolls (user_id, scroll_id, amount)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, scroll_id)
    DO UPDATE SET amount = user_scrolls.amount + EXCLUDED.amount, updated_at = NOW()
    RETURNING amount
    `,
    [userId, scrollId, delta],
  );
  return result.rows[0]?.amount as number;
}

export async function insertScrollLog(
  conn: DbConn,
  userId: number,
  scrollId: string,
  action: 'add' | 'remove',
  amount: number,
  reason: string | null,
): Promise<void> {
  await conn('scroll_logs').insert({
    user_id: userId,
    scroll_id: scrollId,
    action,
    amount,
    reason,
  });
}

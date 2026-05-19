import type { DbConn } from '../client';

export interface UserRow {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export async function upsertUserFromTelegram(
  conn: DbConn,
  user: { id: number; username?: string; firstName?: string; lastName?: string },
): Promise<void> {
  await conn('users')
    .insert({
      id: user.id,
      username: user.username ?? 'not_set',
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
    })
    .onConflict('id')
    .merge({
      username: user.username ?? 'not_set',
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
    });
}

export async function getUserById(conn: DbConn, id: number): Promise<UserRow | undefined> {
  const row = await conn('users').where('id', id).first();
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
  };
}

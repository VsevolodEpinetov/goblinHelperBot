import type { DbConn } from '../client';

export async function getRolesForUser(conn: DbConn, userId: number): Promise<string[]> {
  const rows = await conn('user_roles').where('user_id', userId).select('role');
  return rows.map((r: { role: string }) => r.role);
}

export async function isBanned(conn: DbConn, userId: number): Promise<boolean> {
  const roles = await getRolesForUser(conn, userId);
  return roles.includes('banned') || roles.includes('selfBanned');
}

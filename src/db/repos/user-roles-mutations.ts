import type { DbConn } from '../client';

const UNIQUE_VIOLATION = '23505';

/** Idempotent add. Relies on UNIQUE(user_id, role) — adjust if your schema doesn't have it. */
export async function addRole(conn: DbConn, userId: number, role: string): Promise<boolean> {
  try {
    await conn('user_roles').insert({ user_id: userId, role });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) return false;
    throw err;
  }
}

export async function removeRole(conn: DbConn, userId: number, role: string): Promise<boolean> {
  const n = await conn('user_roles').where({ user_id: userId, role }).delete();
  return n > 0;
}

/**
 * Replace: removes `fromRole`, adds `toRole` sequentially.
 * Caller is responsible for wrapping in a transaction if atomicity is required.
 * Idempotent: if `toRole` already present, the duplicate-key error is silently caught.
 */
export async function replaceRole(
  conn: DbConn,
  userId: number,
  fromRole: string,
  toRole: string,
): Promise<void> {
  await conn('user_roles').where({ user_id: userId, role: fromRole }).delete();
  try {
    await conn('user_roles').insert({ user_id: userId, role: toRole });
  } catch (err) {
    if ((err as { code?: string }).code !== UNIQUE_VIOLATION) throw err;
    // toRole already present — fine.
  }
}

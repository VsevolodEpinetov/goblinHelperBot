import type { DbConn } from '../../db/client';

export interface StudioRow {
  id: number;
  name: string;
}

export type AddStudioResult = 'added' | 'duplicate';

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === UNIQUE_VIOLATION
  );
}

export async function addCoreStudio(conn: DbConn, name: string): Promise<AddStudioResult> {
  try {
    await conn('polls_core_studios').insert({ name });
    return 'added';
  } catch (err) {
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }
}

export async function addDynamicStudio(conn: DbConn, name: string): Promise<AddStudioResult> {
  try {
    await conn('polls_studios').insert({ name });
    return 'added';
  } catch (err) {
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }
}

export async function listCoreStudios(conn: DbConn): Promise<StudioRow[]> {
  return conn('polls_core_studios').orderBy('name', 'asc').select('id', 'name');
}

export async function listDynamicStudios(conn: DbConn): Promise<StudioRow[]> {
  return conn('polls_studios').orderBy('added_at', 'asc').select('id', 'name');
}

export async function resetCoreStudios(conn: DbConn): Promise<number> {
  return conn('polls_core_studios').delete();
}

export async function resetDynamicStudios(conn: DbConn): Promise<number> {
  return conn('polls_studios').delete();
}

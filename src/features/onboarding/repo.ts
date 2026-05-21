import type { DbConn } from '../../db/client';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ApplicationRow {
  id: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: ApplicationStatus;
  invitationCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToApp(row: Record<string, unknown> | undefined): ApplicationRow | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    userId: row.user_id as number,
    username: (row.username as string | null) ?? null,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    status: row.status as ApplicationStatus,
    invitationCode: (row.invitation_code as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function getApplicationByUserId(
  conn: DbConn,
  userId: number,
): Promise<ApplicationRow | undefined> {
  const row = await conn('applications').where('user_id', userId).first();
  return rowToApp(row);
}

export async function getApplicationById(
  conn: DbConn,
  id: number,
): Promise<ApplicationRow | undefined> {
  const row = await conn('applications').where('id', id).first();
  return rowToApp(row);
}

export interface InsertApplicationInput {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export async function insertApplication(
  conn: DbConn,
  input: InsertApplicationInput,
): Promise<number> {
  const [row] = await conn('applications')
    .insert({
      user_id: input.userId,
      username: input.username,
      first_name: input.firstName,
      last_name: input.lastName,
      status: 'pending',
    })
    .returning('id');
  return row.id;
}

export async function setApplicationStatus(
  conn: DbConn,
  id: number,
  status: ApplicationStatus,
): Promise<void> {
  await conn('applications').where('id', id).update({ status, updated_at: conn.fn.now() });
}

export interface ListFilter {
  status?: ApplicationStatus;
  limit?: number;
  offset?: number;
}

export async function listApplications(
  conn: DbConn,
  filter: ListFilter = {},
): Promise<ApplicationRow[]> {
  const q = conn('applications').orderBy('created_at', 'desc');
  if (filter.status) q.where('status', filter.status);
  if (filter.limit !== undefined) q.limit(filter.limit);
  if (filter.offset !== undefined) q.offset(filter.offset);
  const rows = await q;
  return rows.map(rowToApp) as ApplicationRow[];
}

export async function countApplications(
  conn: DbConn,
  filter: { status?: ApplicationStatus } = {},
): Promise<number> {
  const q = conn('applications');
  if (filter.status) q.where('status', filter.status);
  const result = await q.count<{ count: string }[]>('id as count');
  return Number(result[0]?.count ?? 0);
}

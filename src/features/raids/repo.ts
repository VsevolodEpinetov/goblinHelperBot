import type { DbConn } from '../../db/client';

export interface RaidRow {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  price: number;
  currency: string;
  status: 'open' | 'closed' | 'cancelled' | 'completed';
  createdBy: number;
  createdByUsername: string | null;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  chatId: string | null;
  messageId: string | null;
  endDate: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface RaidPhoto {
  id: number;
  raidId: number;
  fileId: string;
  orderIndex: number;
}

export interface RaidParticipant {
  raidId: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  joinedAt: Date;
}

function rowToRaid(row: Record<string, unknown> | undefined): RaidRow | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    link: (row.link as string | null) ?? null,
    price: Number(row.price),
    currency: row.currency as string,
    status: row.status as RaidRow['status'],
    createdBy: row.created_by as number,
    createdByUsername: (row.created_by_username as string | null) ?? null,
    createdByFirstName: (row.created_by_first_name as string | null) ?? null,
    createdByLastName: (row.created_by_last_name as string | null) ?? null,
    chatId: (row.chat_id as string | null) ?? null,
    messageId: (row.message_id as string | null) ?? null,
    endDate: (row.end_date as Date | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as Date,
  };
}

export interface CreateRaidInput {
  title: string;
  description: string | null;
  link: string | null;
  price: number;
  currency: string;
  endDate: Date | null;
  createdBy: number;
  createdByUsername: string | null;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  photoFileIds: string[];
}

/** Create a raid + its photos in one transaction. Returns the new raid id. */
export async function createRaid(conn: DbConn, input: CreateRaidInput): Promise<number> {
  const [row] = await conn('raids')
    .insert({
      title: input.title,
      description: input.description,
      link: input.link,
      price: input.price,
      currency: input.currency,
      end_date: input.endDate,
      created_by: input.createdBy,
      created_by_username: input.createdByUsername,
      created_by_first_name: input.createdByFirstName,
      created_by_last_name: input.createdByLastName,
    })
    .returning('id');
  const id: number = row.id;

  if (input.photoFileIds.length > 0) {
    await conn('raid_photos').insert(
      input.photoFileIds.map((fileId, idx) => ({
        raid_id: id,
        file_id: fileId,
        order_index: idx,
      })),
    );
  }
  return id;
}

export async function getRaidById(conn: DbConn, id: number): Promise<RaidRow | undefined> {
  const row = await conn('raids').where('id', id).first();
  return rowToRaid(row);
}

/** List raids with optional status filter. Uses LEFT JOIN aggregation to avoid N+1. */
export async function listRaids(
  conn: DbConn,
  opts: { status?: RaidRow['status']; limit?: number; offset?: number } = {},
): Promise<RaidRow[]> {
  const q = conn('raids').orderBy('created_at', 'desc');
  if (opts.status) q.where('status', opts.status);
  if (opts.limit !== undefined) q.limit(opts.limit);
  if (opts.offset !== undefined) q.offset(opts.offset);
  const rows = await q;
  return rows.map(rowToRaid) as RaidRow[];
}

export async function getRaidPhotos(conn: DbConn, raidId: number): Promise<RaidPhoto[]> {
  const rows = await conn('raid_photos').where('raid_id', raidId).orderBy('order_index', 'asc');
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    raidId: r.raid_id as number,
    fileId: r.file_id as string,
    orderIndex: r.order_index as number,
  }));
}

export async function getRaidParticipants(
  conn: DbConn,
  raidId: number,
): Promise<RaidParticipant[]> {
  const rows = await conn('raid_participants').where('raid_id', raidId).orderBy('joined_at', 'asc');
  return rows.map((r: Record<string, unknown>) => ({
    raidId: r.raid_id as number,
    userId: r.user_id as number,
    username: (r.username as string | null) ?? null,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    joinedAt: r.joined_at as Date,
  }));
}

export type JoinResult = 'joined' | 'already_joined';

export async function joinRaid(
  conn: DbConn,
  raidId: number,
  user: {
    userId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
): Promise<JoinResult> {
  try {
    await conn('raid_participants').insert({
      raid_id: raidId,
      user_id: user.userId,
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
    });
    return 'joined';
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return 'already_joined';
    throw err;
  }
}

export type LeaveResult = 'left' | 'was_not_in';

export async function leaveRaid(
  conn: DbConn,
  raidId: number,
  userId: number,
): Promise<LeaveResult> {
  const deleted = await conn('raid_participants')
    .where({ raid_id: raidId, user_id: userId })
    .delete();
  return deleted > 0 ? 'left' : 'was_not_in';
}

export async function updateRaidStatus(
  conn: DbConn,
  raidId: number,
  status: RaidRow['status'],
): Promise<void> {
  await conn('raids').where('id', raidId).update({ status, updated_at: conn.fn.now() });
}

export async function updateRaidPublicMessage(
  conn: DbConn,
  raidId: number,
  chatId: string,
  messageId: string,
): Promise<void> {
  await conn('raids').where('id', raidId).update({
    chat_id: chatId,
    message_id: messageId,
    updated_at: conn.fn.now(),
  });
}

/** Forget the stored group card (e.g. when a finished raid leaves the topic). */
export async function clearRaidPublicMessage(conn: DbConn, raidId: number): Promise<void> {
  await conn('raids').where('id', raidId).update({
    chat_id: null,
    message_id: null,
    updated_at: conn.fn.now(),
  });
}

export async function listRaidsByCreator(conn: DbConn, userId: number): Promise<RaidRow[]> {
  const rows = await conn('raids').where('created_by', userId).orderBy('created_at', 'desc');
  return rows.map(rowToRaid) as RaidRow[];
}

export async function listRaidsForParticipant(conn: DbConn, userId: number): Promise<RaidRow[]> {
  const rows = await conn('raids as r')
    .innerJoin('raid_participants as p', 'p.raid_id', 'r.id')
    .where('p.user_id', userId)
    .orderBy('r.created_at', 'desc')
    .select('r.*');
  return rows.map(rowToRaid) as RaidRow[];
}

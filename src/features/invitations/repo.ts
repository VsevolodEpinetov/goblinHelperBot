import type { DbConn } from '../../db/client';

export type GroupType = 'regular' | 'plus';

export interface InvitationLinkRow {
  id: number;
  userId: number;
  groupPeriod: string;
  groupType: GroupType;
  telegramInviteLink: string;
  telegramMetadata: Record<string, unknown>;
  createsJoinRequest: boolean;
  useCount: number;
  usedAt: Date | null;
  createdAt: Date;
  invitationCode: string | null;
}

function rowToInvite(row: Record<string, unknown> | undefined): InvitationLinkRow | undefined {
  if (!row) return undefined;
  return {
    // int8 ids come back as strings from node-postgres — coerce to the number contract.
    id: Number(row.id),
    userId: Number(row.user_id),
    groupPeriod: row.group_period as string,
    groupType: row.group_type as GroupType,
    telegramInviteLink: row.telegram_invite_link as string,
    telegramMetadata: (row.telegram_metadata as Record<string, unknown>) ?? {},
    createsJoinRequest: !!row.creates_join_request,
    useCount: (row.use_count as number) ?? 0,
    usedAt: (row.used_at as Date | null) ?? null,
    createdAt: row.created_at as Date,
    invitationCode: (row.invitation_code as string | null) ?? null,
  };
}

export interface InsertInvitationInput {
  userId: number;
  groupPeriod: string;
  groupType: GroupType;
  telegramInviteLink: string;
  telegramMetadata: Record<string, unknown>;
  createsJoinRequest: boolean;
}

export async function insertInvitation(
  conn: DbConn,
  input: InsertInvitationInput,
): Promise<number> {
  const [row] = await conn('invitation_links')
    .insert({
      user_id: input.userId,
      group_period: input.groupPeriod,
      group_type: input.groupType,
      telegram_invite_link: input.telegramInviteLink,
      telegram_metadata: JSON.stringify(input.telegramMetadata),
      creates_join_request: input.createsJoinRequest,
    })
    .returning('id');
  return Number(row.id);
}

/** Most recent UNUSED link for (user, period, type) — used so we can re-send it if the user lost it. */
export async function findActiveLink(
  conn: DbConn,
  userId: number,
  period: string,
  type: GroupType,
): Promise<InvitationLinkRow | undefined> {
  const row = await conn('invitation_links')
    .where({ user_id: userId, group_period: period, group_type: type })
    .whereNull('used_at')
    .orderBy('created_at', 'desc')
    .first();
  return rowToInvite(row);
}

export async function markUsed(conn: DbConn, id: number): Promise<void> {
  await conn('invitation_links')
    .where('id', id)
    .update({
      used_at: conn.fn.now(),
      use_count: conn.raw('use_count + 1'),
    });
}

/** Find the most-recent invite matching (user, period, type) regardless of used state. */
export async function findLatestForUser(
  conn: DbConn,
  userId: number,
  period: string,
  type: GroupType,
): Promise<InvitationLinkRow | undefined> {
  const row = await conn('invitation_links')
    .where({ user_id: userId, group_period: period, group_type: type })
    .orderBy('created_at', 'desc')
    .first();
  return rowToInvite(row);
}

export async function listForUser(conn: DbConn, userId: number): Promise<InvitationLinkRow[]> {
  const rows = await conn('invitation_links')
    .where('user_id', userId)
    .orderBy('created_at', 'desc');
  return rows.map(rowToInvite) as InvitationLinkRow[];
}

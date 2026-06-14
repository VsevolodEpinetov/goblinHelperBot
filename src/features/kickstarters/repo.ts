import type { DbConn } from '../../db/client';

export interface KickstarterRow {
  id: number;
  name: string;
  creator: string | null;
  cost: number;
  pledgeName: string | null;
  pledgeCost: number | null;
  link: string | null;
  createdAt: Date;
}

export interface KickstarterAsset {
  ord: number;
  fileId: string;
}

function rowToKickstarter(row: Record<string, unknown> | undefined): KickstarterRow | undefined {
  if (!row) return undefined;
  return {
    // int8 ids come back as strings from node-postgres — coerce to the number contract.
    id: Number(row.id),
    name: row.name as string,
    creator: (row.creator as string | null) ?? null,
    cost: Number(row.cost),
    pledgeName: (row.pledge_name as string | null) ?? null,
    pledgeCost: row.pledge_cost == null ? null : Number(row.pledge_cost),
    link: (row.link as string | null) ?? null,
    createdAt: row.created_at as Date,
  };
}

export async function listKickstarters(conn: DbConn): Promise<KickstarterRow[]> {
  const rows = await conn('kickstarters').orderBy('created_at', 'desc');
  return rows.map(rowToKickstarter) as KickstarterRow[];
}

export async function getKickstarterById(
  conn: DbConn,
  id: number,
): Promise<KickstarterRow | undefined> {
  const row = await conn('kickstarters').where('id', id).first();
  return rowToKickstarter(row);
}

export async function getKickstarterPhotos(
  conn: DbConn,
  kickstarterId: number,
): Promise<KickstarterAsset[]> {
  const rows = await conn('kickstarter_photos')
    .where('kickstarter_id', kickstarterId)
    .orderBy('ord', 'asc');
  return rows.map((r: { ord: number; file_id: string }) => ({ ord: r.ord, fileId: r.file_id }));
}

export async function getKickstarterFiles(
  conn: DbConn,
  kickstarterId: number,
): Promise<KickstarterAsset[]> {
  const rows = await conn('kickstarter_files')
    .where('kickstarter_id', kickstarterId)
    .orderBy('ord', 'asc');
  return rows.map((r: { ord: number; file_id: string }) => ({ ord: r.ord, fileId: r.file_id }));
}

export interface CreateKickstarterInput {
  name: string;
  creator: string | null;
  cost: number;
  pledgeName: string | null;
  pledgeCost: number | null;
  link: string | null;
  photoFileIds: string[];
  fileFileIds: string[];
}

/** Create kickstarter + its photos and files. Returns the new id. */
export async function createKickstarter(
  conn: DbConn,
  input: CreateKickstarterInput,
): Promise<number> {
  const [row] = await conn('kickstarters')
    .insert({
      name: input.name,
      creator: input.creator,
      cost: input.cost,
      pledge_name: input.pledgeName,
      pledge_cost: input.pledgeCost,
      link: input.link,
    })
    .returning('id');
  const id = Number(row.id);

  if (input.photoFileIds.length > 0) {
    await conn('kickstarter_photos').insert(
      input.photoFileIds.map((fileId, idx) => ({
        kickstarter_id: id,
        ord: idx + 1,
        file_id: fileId,
      })),
    );
  }
  if (input.fileFileIds.length > 0) {
    await conn('kickstarter_files').insert(
      input.fileFileIds.map((fileId, idx) => ({
        kickstarter_id: id,
        ord: idx + 1,
        file_id: fileId,
      })),
    );
  }
  return id;
}

/** Allowed field updates (whitelist to prevent SQL-via-column-name shenanigans). */
export type EditableField = 'name' | 'creator' | 'cost' | 'pledge_name' | 'pledge_cost' | 'link';

const EDITABLE_FIELDS: ReadonlySet<EditableField> = new Set([
  'name',
  'creator',
  'cost',
  'pledge_name',
  'pledge_cost',
  'link',
]);

export async function updateKickstarterField(
  conn: DbConn,
  id: number,
  field: EditableField,
  value: string | number | null,
): Promise<void> {
  if (!EDITABLE_FIELDS.has(field)) throw new Error(`Field "${field}" is not editable`);
  await conn('kickstarters')
    .where('id', id)
    .update({ [field]: value });
}

export async function hasUserPurchased(
  conn: DbConn,
  userId: number,
  kickstarterId: number,
): Promise<boolean> {
  const row = await conn('user_kickstarters')
    .where({ user_id: userId, kickstarter_id: kickstarterId })
    .first();
  return !!row;
}

/** Insert into user_kickstarters; returns true on insert, false if user already had it. */
export async function recordPurchase(
  conn: DbConn,
  userId: number,
  kickstarterId: number,
): Promise<boolean> {
  try {
    await conn('user_kickstarters').insert({ user_id: userId, kickstarter_id: kickstarterId });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return false;
    throw err;
  }
}

export async function listUserKickstarters(
  conn: DbConn,
  userId: number,
): Promise<KickstarterRow[]> {
  const rows = await conn('kickstarters as k')
    .innerJoin('user_kickstarters as uk', 'uk.kickstarter_id', 'k.id')
    .where('uk.user_id', userId)
    .orderBy('k.created_at', 'desc')
    .select('k.*');
  return rows.map(rowToKickstarter) as KickstarterRow[];
}

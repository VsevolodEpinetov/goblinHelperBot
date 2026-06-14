import type { DbConn } from '../../db/client';

export interface PromoFileRow {
  id: number;
  file_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation' | 'sticker';
  file_name: string | null;
  file_size: number | null;
}

export async function pickPromoFileForUser(
  conn: DbConn,
  userId: number,
): Promise<PromoFileRow | undefined> {
  return conn('promo_files as p')
    .select('p.id', 'p.file_id', 'p.file_type', 'p.file_name', 'p.file_size')
    .where('p.is_active', true)
    .whereNotIn('p.id', function () {
      this.select('u.promo_file_id')
        .from('user_promo_usage as u')
        .where('u.user_id', userId)
        .andWhere('u.cooldown_until', '>', conn.fn.now());
    })
    .orderByRaw('random()')
    .first();
}

export async function getActiveCooldown(conn: DbConn, userId: number): Promise<Date | undefined> {
  const row = await conn('user_promo_usage')
    .where('user_id', userId)
    .andWhere('cooldown_until', '>', conn.fn.now())
    .orderBy('cooldown_until', 'desc')
    .first();
  return row?.cooldown_until;
}

export async function recordPromoUsage(
  conn: DbConn,
  userId: number,
  promoFileId: number,
  cooldownUntil: Date,
): Promise<void> {
  await conn('user_promo_usage').insert({
    user_id: userId,
    promo_file_id: promoFileId,
    cooldown_until: cooldownUntil,
  });
}

export async function addPromoFile(
  conn: DbConn,
  fileId: string,
  fileType: PromoFileRow['file_type'],
  fileName: string | null,
  fileSize: number | null,
  uploadedBy: number,
): Promise<number> {
  const [row] = await conn('promo_files')
    .insert({
      file_id: fileId,
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      uploaded_by: uploadedBy,
    })
    .returning('id');
  return Number(row.id);
}

import { logger } from '../../core/observability';
import { db, type DbConn } from '../../db/client';
import { grantXpInTrx } from '../loyalty';
import { InsufficientScrollsError, useScrollInTrx } from '../scrolls';

import {
  getKickstarterById,
  getKickstarterFiles,
  hasUserPurchased,
  recordPurchase,
  updateKickstarterField,
  type EditableField,
  type KickstarterRow,
} from './repo';

export const XP_FOR_KICKSTARTER_PURCHASE = 300;
const NAME_MAX = 255;

export function validateName(input: string): string {
  const t = input.trim();
  if (t.length === 0) throw new Error('Имя не может быть пустым');
  if (t.length > NAME_MAX) throw new Error(`Имя должно быть до ${NAME_MAX} символов`);
  return t;
}

export function validateCost(input: string): number {
  const n = Number(String(input).replace(',', '.').trim());
  if (!Number.isFinite(n)) throw new Error('Стоимость должна быть числом');
  if (n <= 0) throw new Error('Стоимость должна быть положительной');
  return Math.round(n);
}

export function validateLink(input: string): string | null {
  const t = input.trim();
  if (/^пропустить$/i.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) throw new Error('Ссылка должна начинаться с http:// или https://');
  return t;
}

export type PurchaseScrollResult =
  | { status: 'purchased'; kickstarter: KickstarterRow; fileIds: string[] }
  | { status: 'already_owned'; kickstarter: KickstarterRow; fileIds: string[] }
  | { status: 'not_found' }
  | { status: 'insufficient_scrolls'; scrollId: string; required: number; available: number };

/**
 * Atomic kickstarter redemption using a scroll.
 *
 * - Throws nothing on the "predictable" failure modes (not_found, already_owned, insufficient).
 * - Idempotent: a second call after `purchased` returns `already_owned`.
 * - Grants XP idempotently via `external_id = 'ks:<id>:user:<userId>'`.
 */
export async function purchaseWithScroll(input: {
  userId: number;
  kickstarterId: number;
  scrollId: string;
}): Promise<PurchaseScrollResult> {
  return db.transaction(async (trx): Promise<PurchaseScrollResult> => {
    const ks = await getKickstarterById(trx, input.kickstarterId);
    if (!ks) return { status: 'not_found' };

    if (await hasUserPurchased(trx, input.userId, input.kickstarterId)) {
      const fileIds = (await getKickstarterFiles(trx, input.kickstarterId)).map((f) => f.fileId);
      return { status: 'already_owned', kickstarter: ks, fileIds };
    }

    try {
      await useScrollInTrx(
        trx,
        input.userId,
        input.scrollId,
        1,
        `kickstarter:${input.kickstarterId}`,
      );
    } catch (err) {
      if (err instanceof InsufficientScrollsError) {
        return {
          status: 'insufficient_scrolls',
          scrollId: err.scrollId,
          required: err.required,
          available: err.available,
        };
      }
      throw err;
    }

    await recordPurchase(trx, input.userId, input.kickstarterId);
    try {
      await grantXpInTrx(trx, {
        userId: input.userId,
        amount: XP_FOR_KICKSTARTER_PURCHASE,
        source: 'kickstarter_purchase',
        externalId: `ks:${input.kickstarterId}:user:${input.userId}`,
      });
    } catch (err) {
      logger.warn(
        { err, userId: input.userId, kickstarterId: input.kickstarterId },
        'kickstarter purchase: grantXp failed',
      );
    }

    const fileIds = (await getKickstarterFiles(trx, input.kickstarterId)).map((f) => f.fileId);
    return { status: 'purchased', kickstarter: ks, fileIds };
  });
}

export async function updateField(
  id: number,
  field: EditableField,
  value: string | number | null,
): Promise<void> {
  // Direct repo call kept for symmetry; future logic (e.g., re-publish promo) hooks here.
  await updateKickstarterField(db, id, field, value);
}

export type { DbConn };

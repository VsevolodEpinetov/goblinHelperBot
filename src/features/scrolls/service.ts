import type { DbConn } from '../../db/client';
import { db } from '../../db/client';

import { adjustScrollAmount, getScrollBalance, insertScrollLog } from './repo';

export const KNOWN_SCROLL_IDS = ['kickstarter'] as const;

export type KnownScrollId = (typeof KNOWN_SCROLL_IDS)[number];

export function isKnownScrollId(id: string): id is KnownScrollId {
  return (KNOWN_SCROLL_IDS as readonly string[]).includes(id);
}

export interface GiveScrollInput {
  userId: number;
  scrollId: string;
  amount: number;
  reason?: string;
}

/** Add scrolls to a user's balance. Atomic. */
export async function giveScroll(input: GiveScrollInput): Promise<number> {
  if (input.amount <= 0) throw new Error('giveScroll amount must be positive');
  return db.transaction(async (trx) => {
    const newAmount = await adjustScrollAmount(trx, input.userId, input.scrollId, input.amount);
    await insertScrollLog(
      trx,
      input.userId,
      input.scrollId,
      'add',
      input.amount,
      input.reason ?? null,
    );
    return newAmount;
  });
}

export interface UseScrollInput {
  userId: number;
  scrollId: string;
  amount?: number; // default 1
  reason?: string;
}

export class InsufficientScrollsError extends Error {
  constructor(
    public scrollId: string,
    public required: number,
    public available: number,
  ) {
    super(`Insufficient scrolls "${scrollId}": required ${required}, available ${available}`);
    this.name = 'InsufficientScrollsError';
  }
}

/** Spend N scrolls (default 1). Throws InsufficientScrollsError if balance < amount. Atomic. */
export async function useScroll(input: UseScrollInput): Promise<number> {
  const amount = input.amount ?? 1;
  if (amount <= 0) throw new Error('useScroll amount must be positive');
  return db.transaction(async (trx) =>
    useScrollInTrx(trx, input.userId, input.scrollId, amount, input.reason),
  );
}

export async function useScrollInTrx(
  trx: DbConn,
  userId: number,
  scrollId: string,
  amount: number,
  reason?: string,
): Promise<number> {
  const balance = await getScrollBalance(trx, userId, scrollId);
  if (balance < amount) {
    throw new InsufficientScrollsError(scrollId, amount, balance);
  }
  const newAmount = await adjustScrollAmount(trx, userId, scrollId, -amount);
  await insertScrollLog(trx, userId, scrollId, 'remove', amount, reason ?? null);
  return newAmount;
}

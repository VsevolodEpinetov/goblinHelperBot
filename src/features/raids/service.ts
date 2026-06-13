import { db } from '../../db/client';
import { grantXpInTrx } from '../loyalty';
import type { GrantXpResult } from '../loyalty/service';

import {
  getRaidById,
  joinRaid as repoJoinRaid,
  leaveRaid as repoLeaveRaid,
  updateRaidStatus,
  type RaidRow,
} from './repo';

export const XP_FOR_CREATE = 50;
export const XP_FOR_JOIN = 25;
export const XP_FOR_COMPLETE = 100;

const TITLE_MAX = 255;
const DESC_MIN = 10;
const DESC_MAX = 2000;

export function validateRaidTitle(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0)
    throw new Error('Пустое название не пойдёт. Напиши, что за добычу берём.');
  if (trimmed.length > TITLE_MAX) throw new Error(`Длинно слишком. Уложись в ${TITLE_MAX} знаков.`);
  return trimmed;
}

export function validateRaidDescription(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length < DESC_MIN)
    throw new Error(`Маловато слов. Расскажи подробнее — хотя бы ${DESC_MIN} знаков.`);
  if (trimmed.length > DESC_MAX) throw new Error(`Размахнулся. Уложись в ${DESC_MAX} знаков.`);
  return trimmed;
}

export function validateRaidPrice(input: string): number {
  const normalized = input.replace(',', '.').trim();
  const num = Number(normalized);
  if (!Number.isFinite(num)) throw new Error('Это не цена. Напиши число, можно с копейками.');
  if (num < 0) throw new Error('Цена меньше нуля? Так не торгуют. Напиши по-честному.');
  return num;
}

/** Parse a Russian-style date "DD.MM" or "DD.MM.YYYY". Returns null if malformed. */
export function parseRaidDate(input: string, reference: Date = new Date()): Date | null {
  const match = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : reference.getUTCFullYear();

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  // If no year specified and the date is already in the past, roll forward
  if (!match[3]) {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getTime() < reference.getTime()) year += 1;
  }

  const result = new Date(Date.UTC(year, month - 1, day));
  // Validate that JS didn't wrap (e.g., 31.02 → 03.03)
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return null;
  }
  return result;
}

/** Join + award XP atomically. Idempotent via PRIMARY KEY (raid_id, user_id). */
export async function joinRaidAndAward(
  raidId: number,
  user: {
    userId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
): Promise<{ result: 'joined' | 'already_joined'; xp: GrantXpResult | null }> {
  return db.transaction(async (trx) => {
    const result = await repoJoinRaid(trx, raidId, user);
    if (result !== 'joined') return { result, xp: null };
    const xp = await grantXpInTrx(trx, {
      userId: user.userId,
      amount: XP_FOR_JOIN,
      source: 'raid_join',
      externalId: `raid:${raidId}:user:${user.userId}`,
    });
    return { result, xp };
  });
}

export async function leaveRaidAtomic(
  raidId: number,
  userId: number,
): Promise<'left' | 'was_not_in'> {
  return db.transaction(async (trx) => repoLeaveRaid(trx, raidId, userId));
}

export async function closeRaid(raidId: number): Promise<RaidRow | undefined> {
  await updateRaidStatus(db, raidId, 'closed');
  return getRaidById(db, raidId);
}

export async function completeRaid(
  raidId: number,
): Promise<{ raid: RaidRow; xp: GrantXpResult } | undefined> {
  return db.transaction(async (trx) => {
    const raid = await getRaidById(trx, raidId);
    if (!raid) return undefined;
    await updateRaidStatus(trx, raidId, 'completed');
    // Award XP to creator for completion (idempotent via externalId)
    const xp = await grantXpInTrx(trx, {
      userId: raid.createdBy,
      amount: XP_FOR_COMPLETE,
      source: 'raid_complete',
      externalId: `raid:${raidId}`,
    });
    return { raid: { ...raid, status: 'completed' as const }, xp };
  });
}

export async function cancelRaid(raidId: number): Promise<RaidRow | undefined> {
  await updateRaidStatus(db, raidId, 'cancelled');
  return getRaidById(db, raidId);
}

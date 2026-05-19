import { logger } from '../../core/observability';
import { db } from '../../db/client';
import { grantXp } from '../loyalty';

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
  if (trimmed.length === 0) throw new Error('Title cannot be empty');
  if (trimmed.length > TITLE_MAX) throw new Error(`Title cannot exceed ${TITLE_MAX} chars`);
  return trimmed;
}

export function validateRaidDescription(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length < DESC_MIN) throw new Error(`Description must be at least ${DESC_MIN} chars`);
  if (trimmed.length > DESC_MAX) throw new Error(`Description cannot exceed ${DESC_MAX} chars`);
  return trimmed;
}

export function validateRaidPrice(input: string): number {
  const normalized = input.replace(',', '.').trim();
  const num = Number(normalized);
  if (!Number.isFinite(num)) throw new Error('Price must be a number');
  if (num < 0) throw new Error('Price must be non-negative');
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

/** Join + award XP. Idempotent via PRIMARY KEY (raid_id, user_id). */
export async function joinRaidAndAward(
  raidId: number,
  user: {
    userId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
): Promise<'joined' | 'already_joined'> {
  return db.transaction(async (trx) => {
    const result = await repoJoinRaid(trx, raidId, user);
    if (result === 'joined') {
      try {
        await grantXp({
          userId: user.userId,
          amount: XP_FOR_JOIN,
          source: 'raid_join',
          externalId: `raid:${raidId}:user:${user.userId}`,
        });
      } catch (err) {
        logger.warn({ err, raidId, userId: user.userId }, 'raid: grantXp for join failed');
      }
    }
    return result;
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

export async function completeRaid(raidId: number): Promise<RaidRow | undefined> {
  const raid = await getRaidById(db, raidId);
  if (!raid) return undefined;
  await updateRaidStatus(db, raidId, 'completed');
  // Award XP to creator for completion (idempotent via externalId)
  try {
    await grantXp({
      userId: raid.createdBy,
      amount: XP_FOR_COMPLETE,
      source: 'raid_complete',
      externalId: `raid:${raidId}`,
    });
  } catch (err) {
    logger.warn({ err, raidId }, 'raid: grantXp for complete failed');
  }
  return { ...raid, status: 'completed' };
}

export async function cancelRaid(raidId: number): Promise<RaidRow | undefined> {
  await updateRaidStatus(db, raidId, 'cancelled');
  return getRaidById(db, raidId);
}

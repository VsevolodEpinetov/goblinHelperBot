import { logger } from '../../core/observability';
import type { DbConn } from '../../db/client';
import { db } from '../../db/client';
import { computeRank } from '../../shared/xp';

import { getUserLevel, insertXpTransaction, upsertUserLevel } from './repo';

export interface RankSnapshot {
  tier: string;
  level: number;
}

export type LevelUpEvent =
  | { type: 'level'; from: number; to: number; tier: string }
  | { type: 'tier'; fromTier: string; toTier: string; toLevel: number };

export function detectLevelUp(before: RankSnapshot, after: RankSnapshot): LevelUpEvent | null {
  if (before.tier !== after.tier) {
    return { type: 'tier', fromTier: before.tier, toTier: after.tier, toLevel: after.level };
  }
  if (before.level !== after.level) {
    return { type: 'level', from: before.level, to: after.level, tier: after.tier };
  }
  return null;
}

export interface GrantXpInput {
  userId: number;
  amount: number;
  source: string;
  /** Idempotency key. If a row with (source, externalId) already exists, this call is a no-op. */
  externalId?: string;
  description?: string;
  metadata?: unknown;
}

export interface GrantXpResult {
  applied: boolean;
  totalXp: number;
  tier: string;
  level: number;
  levelUp: LevelUpEvent | null;
}

/**
 * Idempotent, transactional XP grant. Returns `applied: false` if the (source, externalId)
 * pair already exists in `xp_transactions`. The single source of truth for XP changes.
 */
export async function grantXp(input: GrantXpInput): Promise<GrantXpResult> {
  return db.transaction(async (trx) => grantXpInTrx(trx, input));
}

export async function grantXpInTrx(trx: DbConn, input: GrantXpInput): Promise<GrantXpResult> {
  const before = await getUserLevel(trx, input.userId);

  const inserted = await insertXpTransaction(trx, {
    userId: input.userId,
    amount: input.amount,
    source: input.source,
    externalId: input.externalId,
    description: input.description,
    metadata: input.metadata,
  });

  if (!inserted) {
    // Already applied earlier — short-circuit.
    logger.debug(
      { userId: input.userId, source: input.source, externalId: input.externalId },
      'grantXp: idempotent skip',
    );
    return {
      applied: false,
      totalXp: before?.totalXp ?? 0,
      tier: before?.currentTier ?? 'wood',
      level: before?.currentLevel ?? 1,
      levelUp: null,
    };
  }

  const newTotalXp = (before?.totalXp ?? 0) + input.amount;
  const rank = computeRank(newTotalXp);
  await upsertUserLevel(trx, {
    userId: input.userId,
    currentTier: rank.tier.name,
    currentLevel: rank.level,
    totalXp: newTotalXp,
    xpToNextLevel: rank.xpToNextLevel,
    levelUpDate:
      before && (rank.tier.name !== before.currentTier || rank.level !== before.currentLevel)
        ? new Date()
        : (before?.levelUpDate ?? null),
  });

  const beforeSnap: RankSnapshot = {
    tier: before?.currentTier ?? 'wood',
    level: before?.currentLevel ?? 1,
  };
  const afterSnap: RankSnapshot = { tier: rank.tier.name, level: rank.level };
  const levelUp = detectLevelUp(beforeSnap, afterSnap);

  return {
    applied: true,
    totalXp: newTotalXp,
    tier: rank.tier.name,
    level: rank.level,
    levelUp,
  };
}

export async function getProfile(userId: number): Promise<{
  totalXp: number;
  tier: { name: string; displayName: string; emoji: string };
  level: number;
  xpToNextLevel: number;
  nextTierXp: number | null;
} | null> {
  const row = await getUserLevel(db, userId);
  if (!row) return null;
  const rank = computeRank(row.totalXp);
  return {
    totalXp: row.totalXp,
    tier: { name: rank.tier.name, displayName: rank.tier.displayName, emoji: rank.tier.emoji },
    level: rank.level,
    xpToNextLevel: rank.xpToNextLevel,
    nextTierXp: rank.nextTierXp,
  };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbConn } from '../../db/client';

import { getUserLevel, insertXpTransaction, upsertUserLevel, type UserLevelRow } from './repo';
import { detectLevelUp, grantXpInTrx } from './service';

vi.mock('../../db/client', () => ({ db: {} }));
vi.mock('./repo', () => ({
  getUserLevel: vi.fn(),
  insertXpTransaction: vi.fn(),
  upsertUserLevel: vi.fn(),
}));

const trx = {} as DbConn;

function levelRow(partial: Partial<UserLevelRow>): UserLevelRow {
  return {
    userId: 1,
    currentTier: 'wood',
    currentLevel: 1,
    totalXp: 0,
    totalSpendingUnits: 0,
    xpToNextLevel: null,
    levelUpDate: null,
    updatedAt: new Date(),
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserLevel).mockResolvedValue(undefined);
  vi.mocked(insertXpTransaction).mockResolvedValue(true);
});

describe('loyalty.service.detectLevelUp', () => {
  it('returns null when neither tier nor level changed', () => {
    expect(detectLevelUp({ tier: 'wood', level: 3 }, { tier: 'wood', level: 3 })).toBeNull();
  });

  it('reports a level-up within the same tier', () => {
    const out = detectLevelUp({ tier: 'wood', level: 3 }, { tier: 'wood', level: 4 });
    expect(out).toEqual({ type: 'level', from: 3, to: 4, tier: 'wood' });
  });

  it('reports a tier promotion', () => {
    const out = detectLevelUp({ tier: 'wood', level: 10 }, { tier: 'bronze', level: 1 });
    expect(out).toEqual({ type: 'tier', fromTier: 'wood', toTier: 'bronze', toLevel: 1 });
  });

  it('reports a tier promotion even if level is non-1 after the jump', () => {
    const out = detectLevelUp({ tier: 'silver', level: 5 }, { tier: 'gold', level: 2 });
    expect(out).toEqual({ type: 'tier', fromTier: 'silver', toTier: 'gold', toLevel: 2 });
  });
});

describe('loyalty.service.grantXpInTrx', () => {
  it('passes the idempotency key and source through to the transaction insert', async () => {
    await grantXpInTrx(trx, {
      userId: 1,
      amount: 600,
      source: 'payment_sub',
      externalId: 'charge-1',
      description: 'd',
    });
    expect(insertXpTransaction).toHaveBeenCalledWith(
      trx,
      expect.objectContaining({
        userId: 1,
        amount: 600,
        source: 'payment_sub',
        externalId: 'charge-1',
      }),
    );
  });

  it('skips a duplicate (source, externalId) grant without touching user_levels', async () => {
    vi.mocked(insertXpTransaction).mockResolvedValue(false);
    const result = await grantXpInTrx(trx, {
      userId: 1,
      amount: 600,
      source: 'payment_sub',
      externalId: 'charge-1',
    });
    expect(result).toEqual({
      applied: false,
      gained: 0,
      totalXp: 0,
      tier: 'wood',
      level: 1,
      levelUp: null,
    });
    expect(upsertUserLevel).not.toHaveBeenCalled();
  });

  it('echoes the existing snapshot unchanged on a duplicate grant', async () => {
    vi.mocked(getUserLevel).mockResolvedValue(
      levelRow({ totalXp: 500, currentTier: 'wood', currentLevel: 3 }),
    );
    vi.mocked(insertXpTransaction).mockResolvedValue(false);
    const result = await grantXpInTrx(trx, {
      userId: 1,
      amount: 600,
      source: 's',
      externalId: 'x',
    });
    expect(result).toEqual({
      applied: false,
      gained: 0,
      totalXp: 500,
      tier: 'wood',
      level: 3,
      levelUp: null,
    });
  });

  it('creates a fresh level row from wood/level-1 defaults on the first ever grant', async () => {
    const result = await grantXpInTrx(trx, { userId: 1, amount: 150, source: 's' });
    expect(result).toEqual({
      applied: true,
      gained: 150,
      totalXp: 150,
      tier: 'wood',
      level: 1,
      levelUp: null,
    });
    expect(upsertUserLevel).toHaveBeenCalledWith(
      trx,
      expect.objectContaining({
        userId: 1,
        currentTier: 'wood',
        currentLevel: 1,
        totalXp: 150,
        levelUpDate: null,
      }),
    );
  });

  it('rolls totalXp up from the previous row and reports a level-up with a fresh levelUpDate', async () => {
    vi.mocked(getUserLevel).mockResolvedValue(
      levelRow({ totalXp: 150, currentTier: 'wood', currentLevel: 1 }),
    );
    const result = await grantXpInTrx(trx, { userId: 1, amount: 100, source: 's' });
    expect(result).toEqual({
      applied: true,
      gained: 100,
      totalXp: 250,
      tier: 'wood',
      level: 2,
      levelUp: { type: 'level', from: 1, to: 2, tier: 'wood' },
    });
    expect(upsertUserLevel).toHaveBeenCalledWith(
      trx,
      expect.objectContaining({ totalXp: 250, currentLevel: 2, levelUpDate: expect.any(Date) }),
    );
  });

  it('reports a tier promotion when the grant crosses a tier boundary', async () => {
    vi.mocked(getUserLevel).mockResolvedValue(
      levelRow({ totalXp: 1900, currentTier: 'wood', currentLevel: 10 }),
    );
    const result = await grantXpInTrx(trx, { userId: 1, amount: 600, source: 's' });
    expect(result.totalXp).toBe(2500);
    expect(result.levelUp).toEqual({
      type: 'tier',
      fromTier: 'wood',
      toTier: 'bronze',
      toLevel: 2,
    });
    expect(upsertUserLevel).toHaveBeenCalledWith(
      trx,
      expect.objectContaining({
        currentTier: 'bronze',
        currentLevel: 2,
        levelUpDate: expect.any(Date),
      }),
    );
  });

  it('preserves the previous levelUpDate when neither tier nor level changed', async () => {
    const previous = new Date('2026-01-01T00:00:00Z');
    vi.mocked(getUserLevel).mockResolvedValue(
      levelRow({ totalXp: 100, currentTier: 'wood', currentLevel: 1, levelUpDate: previous }),
    );
    const result = await grantXpInTrx(trx, { userId: 1, amount: 50, source: 's' });
    expect(result.levelUp).toBeNull();
    expect(upsertUserLevel).toHaveBeenCalledWith(
      trx,
      expect.objectContaining({ totalXp: 150, currentLevel: 1, levelUpDate: previous }),
    );
  });
});

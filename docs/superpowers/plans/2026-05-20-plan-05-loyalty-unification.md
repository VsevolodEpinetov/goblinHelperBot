# Plan 05 — Loyalty Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `features/loyalty/`, `features/scrolls/`, `features/achievements/` — three tightly related domain modules that together replace the legacy `modules/loyalty/*` and the dual-XP-system problem the audit found. After this plan: one XP grant function (idempotent, transactional, sends a single notification per event), one tier source (`user_levels`), one scroll ledger (counter + audit), and one idempotent achievement grant.

**Architecture:** Each feature is a standard `src/features/<x>/` folder with `index.ts` (public surface), `repo.ts`, `service.ts` (+ unit tests where pure logic exists), `routes.ts`, `schemas.ts`, optional `menus.ts`. The XP grant in `loyalty/service.ts` is the cornerstone: it wraps DB writes in a transaction, checks idempotency via `xp_transactions UNIQUE(source, external_id)`, recalculates rank from total XP via `shared/xp.ts::computeRank`, and dispatches a single notification. All payment/raid/achievement flows in later plans call this one function.

**Tech Stack:** TypeScript, knex (via repos), Vitest, Telegraf, zod.

**Spec reference:** `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md` §4.2.

**Prerequisites:** Plans 01–04 complete. The `xp_transactions` and `user_levels` tables exist with the post-migration-018 snake_case shape; migration 019 added `xp_transactions.external_id` + UNIQUE(source, external_id); migration 020 added UNIQUE(user_id, achievement_type) on `user_achievements`.

**Out of scope:**
- Wiring XP into payment/raid/message flows (the consumer plans — 06+).
- Admin override of tier via `/set_level` (dropped per scope decisions).

---

## File Structure

**Created (`src/features/loyalty/`):**
- `repo.ts`, `service.ts` + `service.test.ts`, `notifications.ts`, `routes.ts`, `schemas.ts`, `menus.ts`, `index.ts`

**Created (`src/features/scrolls/`):**
- `repo.ts`, `service.ts` + `service.test.ts`, `index.ts`

**Created (`src/features/achievements/`):**
- `repo.ts`, `service.ts`, `index.ts`

**Created (integration tests):**
- `tests/integration/loyalty.repo.test.ts`
- `tests/integration/scrolls.repo.test.ts`
- `tests/integration/achievements.repo.test.ts`

**Modified:**
- `src/index.ts` — register the three features (no user-facing routes from scrolls/achievements yet; loyalty adds `/profile` and `/leaderboard`)

---

## Task 1: `src/features/loyalty/repo.ts`

**Files:**
- Create: `src/features/loyalty/repo.ts`

Schema reminders (snake_case post-018, plus migration 019's `external_id`):
- `user_levels(user_id PK, current_tier, current_level, total_xp, total_spending_units, xp_to_next_level, level_up_date, created_at, updated_at)`
- `xp_transactions(id, user_id, amount, source, description, metadata jsonb, external_id, created_at)` with UNIQUE(source, external_id) partial index

### Step 1: Implement

```typescript
import type { DbConn } from '../../db/client';

export interface UserLevelRow {
  userId: number;
  currentTier: string;
  currentLevel: number;
  totalXp: number;
  totalSpendingUnits: number;
  xpToNextLevel: number | null;
  levelUpDate: Date | null;
  updatedAt: Date;
}

export interface XpTransactionRow {
  id: number;
  userId: number;
  amount: number;
  source: string;
  externalId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
}

function rowToUserLevel(row: Record<string, unknown> | undefined): UserLevelRow | undefined {
  if (!row) return undefined;
  return {
    userId: row.user_id as number,
    currentTier: row.current_tier as string,
    currentLevel: row.current_level as number,
    totalXp: row.total_xp as number,
    totalSpendingUnits: Number(row.total_spending_units),
    xpToNextLevel: (row.xp_to_next_level as number | null) ?? null,
    levelUpDate: (row.level_up_date as Date | null) ?? null,
    updatedAt: row.updated_at as Date,
  };
}

export async function getUserLevel(conn: DbConn, userId: number): Promise<UserLevelRow | undefined> {
  const row = await conn('user_levels').where('user_id', userId).first();
  return rowToUserLevel(row);
}

export async function upsertUserLevel(
  conn: DbConn,
  data: {
    userId: number;
    currentTier: string;
    currentLevel: number;
    totalXp: number;
    totalSpendingUnits?: number;
    xpToNextLevel?: number | null;
    levelUpDate?: Date | null;
  },
): Promise<void> {
  await conn('user_levels')
    .insert({
      user_id: data.userId,
      current_tier: data.currentTier,
      current_level: data.currentLevel,
      total_xp: data.totalXp,
      total_spending_units: data.totalSpendingUnits ?? 0,
      xp_to_next_level: data.xpToNextLevel ?? null,
      level_up_date: data.levelUpDate ?? null,
      updated_at: conn.fn.now(),
    })
    .onConflict('user_id')
    .merge({
      current_tier: data.currentTier,
      current_level: data.currentLevel,
      total_xp: data.totalXp,
      xp_to_next_level: data.xpToNextLevel ?? null,
      level_up_date: data.levelUpDate ?? null,
      updated_at: conn.fn.now(),
    });
}

export interface InsertXpInput {
  userId: number;
  amount: number;
  source: string;
  externalId?: string | null;
  description?: string;
  metadata?: unknown;
}

/** Returns true if the row was inserted; false if a UNIQUE(source, external_id) collision occurred. */
export async function insertXpTransaction(conn: DbConn, input: InsertXpInput): Promise<boolean> {
  try {
    await conn('xp_transactions').insert({
      user_id: input.userId,
      amount: input.amount,
      source: input.source,
      external_id: input.externalId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return false;
    throw err;
  }
}

export interface LeaderboardEntry {
  userId: number;
  totalXp: number;
  currentTier: string;
  currentLevel: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export async function getLeaderboard(conn: DbConn, limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await conn('user_levels as l')
    .leftJoin('users as u', 'u.id', 'l.user_id')
    .select(
      'l.user_id',
      'l.total_xp',
      'l.current_tier',
      'l.current_level',
      'u.username',
      'u.first_name',
      'u.last_name',
    )
    .orderBy('l.total_xp', 'desc')
    .limit(limit);

  return rows.map((r: Record<string, unknown>) => ({
    userId: r.user_id as number,
    totalXp: r.total_xp as number,
    currentTier: r.current_tier as string,
    currentLevel: r.current_level as number,
    username: (r.username as string | null) ?? null,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
  }));
}
```

### Step 2: Verify + commit

```bash
npm run typecheck
mkdir -p src/features/loyalty
# write repo.ts above
git add src/features/loyalty/repo.ts
git commit -m "feat(features/loyalty): repository for user_levels + xp_transactions"
```

---

## Task 2: `src/features/loyalty/service.ts` — the canonical grantXp (TDD)

**Files:**
- Create: `src/features/loyalty/service.ts`
- Create: `src/features/loyalty/service.test.ts`

### Step 1: Test (`service.test.ts`)

Most of the service is DB-bound — only the level-up detection logic is pure. Test that here. The full grantXp round-trip is exercised in the integration test (Task 7).

```typescript
import { describe, expect, it } from 'vitest';

import { detectLevelUp } from './service';

describe('loyalty.service.detectLevelUp', () => {
  it('returns null when neither tier nor level changed', () => {
    expect(
      detectLevelUp(
        { tier: 'wood', level: 3 },
        { tier: 'wood', level: 3 },
      ),
    ).toBeNull();
  });

  it('reports a level-up within the same tier', () => {
    const out = detectLevelUp(
      { tier: 'wood', level: 3 },
      { tier: 'wood', level: 4 },
    );
    expect(out).toEqual({ type: 'level', from: 3, to: 4, tier: 'wood' });
  });

  it('reports a tier promotion', () => {
    const out = detectLevelUp(
      { tier: 'wood', level: 10 },
      { tier: 'bronze', level: 1 },
    );
    expect(out).toEqual({ type: 'tier', fromTier: 'wood', toTier: 'bronze', toLevel: 1 });
  });

  it('reports a tier promotion even if level is non-1 after the jump', () => {
    const out = detectLevelUp(
      { tier: 'silver', level: 5 },
      { tier: 'gold', level: 2 },
    );
    expect(out).toEqual({ type: 'tier', fromTier: 'silver', toTier: 'gold', toLevel: 2 });
  });
});
```

### Step 2: Implement `src/features/loyalty/service.ts`

```typescript
import { computeRank } from '../../shared/xp';
import type { DbConn } from '../../db/client';
import { db } from '../../db/client';
import { logger } from '../../core/observability';

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
    logger.debug({ userId: input.userId, source: input.source, externalId: input.externalId }, 'grantXp: idempotent skip');
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
    levelUpDate: before && (rank.tier.name !== before.currentTier || rank.level !== before.currentLevel)
      ? new Date()
      : before?.levelUpDate ?? null,
  });

  const beforeSnap: RankSnapshot = { tier: before?.currentTier ?? 'wood', level: before?.currentLevel ?? 1 };
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
```

### Step 3: Run tests + commit

```bash
npx vitest run src/features/loyalty/service.test.ts
git add src/features/loyalty/service.ts src/features/loyalty/service.test.ts
git commit -m "feat(features/loyalty): idempotent grantXp + level-up detection"
```

---

## Task 3: `src/features/loyalty/notifications.ts` (single source for XP DMs)

**Files:**
- Create: `src/features/loyalty/notifications.ts`

The legacy bot had THREE places that sent XP/level-up notifications, causing duplicate messages. This module is the only one. Other code calls these functions; nothing else messages the user about XP.

### Step 1: Implement

```typescript
import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { tierByName } from '../../shared/loyalty-config';

import type { GrantXpResult, LevelUpEvent } from './service';

const MIN_XP_TO_NOTIFY = 10;

/** Send the user a DM about an XP gain, throttled by MIN_XP_TO_NOTIFY. */
export async function sendXpGainNotification(userId: number, result: GrantXpResult, source: string): Promise<void> {
  if (!result.applied || result.levelUp || Math.abs(result.totalXp) < MIN_XP_TO_NOTIFY) return;
  // Don't double-notify when there's a level-up — the level-up message replaces it.
  try {
    await bot.telegram.sendMessage(
      userId,
      `+${MIN_XP_TO_NOTIFY}+ XP за ${source}. Всего: ${result.totalXp} XP.`,
    );
  } catch (err) {
    logger.debug({ err, userId }, 'sendXpGainNotification failed (probably blocked bot)');
  }
}

export async function sendLevelUpNotification(userId: number, event: LevelUpEvent): Promise<void> {
  try {
    if (event.type === 'tier') {
      const tier = tierByName(event.toTier);
      const emoji = tier?.emoji ?? '';
      const display = tier?.displayName ?? event.toTier;
      await bot.telegram.sendMessage(
        userId,
        `🎉 Новый ранг: ${emoji} <b>${display}</b> (уровень ${event.toLevel})`,
        { parse_mode: 'HTML' },
      );
    } else {
      const tier = tierByName(event.tier);
      const emoji = tier?.emoji ?? '';
      await bot.telegram.sendMessage(
        userId,
        `⬆️ Уровень ${event.to} ${emoji}`,
      );
    }
  } catch (err) {
    logger.debug({ err, userId, event }, 'sendLevelUpNotification failed');
  }
}

/** Fire-and-forget convenience wrapper used by feature callers. */
export function dispatchNotifications(userId: number, result: GrantXpResult, source: string): void {
  void (async () => {
    if (result.levelUp) {
      await sendLevelUpNotification(userId, result.levelUp);
    } else {
      await sendXpGainNotification(userId, result, source);
    }
  })();
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/loyalty/notifications.ts
git commit -m "feat(features/loyalty): single-source XP and level-up notifications"
```

---

## Task 4: `src/features/loyalty/schemas.ts`, `menus.ts`, `routes.ts`, `index.ts`

**Files:**
- Create: `src/features/loyalty/schemas.ts`
- Create: `src/features/loyalty/menus.ts`
- Create: `src/features/loyalty/routes.ts`
- Create: `src/features/loyalty/index.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const loyaltyCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('profile') }),
  z.object({ a: z.literal('leaders') }),
]);
```

### Step 2: `menus.ts`

```typescript
import { tierByName } from '../../shared/loyalty-config';
import type { LeaderboardEntry } from './repo';

export function profileText(profile: {
  totalXp: number;
  tier: { name: string; displayName: string; emoji: string };
  level: number;
  xpToNextLevel: number;
  nextTierXp: number | null;
}): string {
  const lines = [
    `${profile.tier.emoji} <b>${profile.tier.displayName}</b> — уровень ${profile.level}`,
    `XP: <code>${profile.totalXp}</code>`,
  ];
  if (profile.nextTierXp !== null) {
    lines.push(`До следующего уровня: ${profile.xpToNextLevel} XP`);
  }
  return lines.join('\n');
}

export function leaderboardText(rows: LeaderboardEntry[]): string {
  if (rows.length === 0) return 'Пока пусто.';
  return rows
    .map((r, i) => {
      const tier = tierByName(r.currentTier);
      const emoji = tier?.emoji ?? '•';
      const name = r.username
        ? `@${r.username}`
        : [r.firstName, r.lastName].filter(Boolean).join(' ') || `id:${r.userId}`;
      return `${i + 1}. ${emoji} ${name} — ${r.totalXp} XP`;
    })
    .join('\n');
}
```

### Step 3: `routes.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';

import { leaderboardText, profileText } from './menus';
import { getLeaderboard } from './repo';
import { getProfile } from './service';

export function register(bot: Telegraf): void {
  bot.command('profile', async (ctx) => {
    if (!ctx.from) return;
    const profile = await getProfile(ctx.from.id);
    if (!profile) {
      await ctx.reply('У тебя пока нет XP. Активность в группах его даёт.');
      return;
    }
    await ctx.reply(profileText(profile), { parse_mode: 'HTML' });
  });

  bot.command('leaderboard', async (ctx) => {
    const rows = await getLeaderboard(db, 10);
    await ctx.reply(leaderboardText(rows), { parse_mode: 'HTML' });
  });
}
```

### Step 4: `index.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { register as registerRoutes } from './routes';

export { grantXp, grantXpInTrx, getProfile } from './service';
export { dispatchNotifications, sendXpGainNotification, sendLevelUpNotification } from './notifications';
export { getUserLevel, getLeaderboard } from './repo';

export function register(bot: Telegraf): void {
  registerRoutes(bot);
}
```

### Step 5: Verify + commit

```bash
npm run typecheck
npm run lint
git add src/features/loyalty/schemas.ts src/features/loyalty/menus.ts src/features/loyalty/routes.ts src/features/loyalty/index.ts
git commit -m "feat(features/loyalty): /profile and /leaderboard commands"
```

---

## Task 5: `src/features/scrolls/repo.ts` and `src/features/scrolls/service.ts`

**Files:**
- Create: `src/features/scrolls/repo.ts`
- Create: `src/features/scrolls/service.ts`
- Create: `src/features/scrolls/index.ts`

Schema (snake_case post-018):
- `user_scrolls(id, user_id, scroll_id, amount default 0, lifetime nullable, created_at, updated_at)` with UNIQUE(user_id, scroll_id)
- `scroll_logs(id, user_id, scroll_id, action ('add'|'remove'), amount, reason nullable, created_at)`

### Step 1: `src/features/scrolls/repo.ts`

```typescript
import type { DbConn } from '../../db/client';

export interface ScrollBalance {
  scrollId: string;
  amount: number;
}

export async function getUserScrolls(conn: DbConn, userId: number): Promise<ScrollBalance[]> {
  const rows = await conn('user_scrolls')
    .where('user_id', userId)
    .where('amount', '>', 0)
    .select('scroll_id', 'amount');
  return rows.map((r: { scroll_id: string; amount: number }) => ({
    scrollId: r.scroll_id,
    amount: r.amount,
  }));
}

export async function getScrollBalance(
  conn: DbConn,
  userId: number,
  scrollId: string,
): Promise<number> {
  const row = await conn('user_scrolls')
    .where({ user_id: userId, scroll_id: scrollId })
    .select('amount')
    .first();
  return row?.amount ?? 0;
}

export async function adjustScrollAmount(
  conn: DbConn,
  userId: number,
  scrollId: string,
  delta: number,
): Promise<number> {
  // Upsert + atomic increment of `amount`.
  const result = await conn.raw(
    `
    INSERT INTO user_scrolls (user_id, scroll_id, amount)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, scroll_id)
    DO UPDATE SET amount = user_scrolls.amount + EXCLUDED.amount, updated_at = NOW()
    RETURNING amount
    `,
    [userId, scrollId, delta],
  );
  return result.rows[0]?.amount as number;
}

export async function insertScrollLog(
  conn: DbConn,
  userId: number,
  scrollId: string,
  action: 'add' | 'remove',
  amount: number,
  reason: string | null,
): Promise<void> {
  await conn('scroll_logs').insert({
    user_id: userId,
    scroll_id: scrollId,
    action,
    amount,
    reason,
  });
}
```

### Step 2: `src/features/scrolls/service.ts`

```typescript
import type { DbConn } from '../../db/client';
import { db } from '../../db/client';

import { adjustScrollAmount, getScrollBalance, insertScrollLog } from './repo';

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
    await insertScrollLog(trx, input.userId, input.scrollId, 'add', input.amount, input.reason ?? null);
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
  constructor(public scrollId: string, public required: number, public available: number) {
    super(`Insufficient scrolls "${scrollId}": required ${required}, available ${available}`);
    this.name = 'InsufficientScrollsError';
  }
}

/** Spend N scrolls (default 1). Throws InsufficientScrollsError if balance < amount. Atomic. */
export async function useScroll(input: UseScrollInput): Promise<number> {
  const amount = input.amount ?? 1;
  if (amount <= 0) throw new Error('useScroll amount must be positive');
  return db.transaction(async (trx) => useScrollInTrx(trx, input.userId, input.scrollId, amount, input.reason));
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
```

### Step 3: `src/features/scrolls/index.ts`

```typescript
export {
  giveScroll,
  useScroll,
  useScrollInTrx,
  InsufficientScrollsError,
} from './service';
export { getUserScrolls, getScrollBalance } from './repo';
```

### Step 4: Commit

```bash
mkdir -p src/features/scrolls
# write all three files above
npm run typecheck
npm run lint
git add src/features/scrolls/
git commit -m "feat(features/scrolls): atomic give/use with audit log"
```

---

## Task 6: `src/features/achievements/repo.ts`, `service.ts`, `index.ts`

**Files:**
- Create: `src/features/achievements/repo.ts`
- Create: `src/features/achievements/service.ts`
- Create: `src/features/achievements/index.ts`

Schema:
- `user_achievements(id, user_id, achievement_type, achievement_data jsonb, unlocked_at, is_public)` with UNIQUE(user_id, achievement_type) post-020

### Step 1: `repo.ts`

```typescript
import type { DbConn } from '../../db/client';

const UNIQUE_VIOLATION = '23505';

export interface AchievementRow {
  id: number;
  userId: number;
  achievementType: string;
  data: unknown;
  unlockedAt: Date;
  isPublic: boolean;
}

export async function listForUser(conn: DbConn, userId: number): Promise<AchievementRow[]> {
  const rows = await conn('user_achievements')
    .where('user_id', userId)
    .orderBy('unlocked_at', 'desc');
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    userId: r.user_id as number,
    achievementType: r.achievement_type as string,
    data: r.achievement_data,
    unlockedAt: r.unlocked_at as Date,
    isPublic: r.is_public as boolean,
  }));
}

/** Returns true if a new row was inserted; false if (user, type) already existed. */
export async function insertAchievement(
  conn: DbConn,
  userId: number,
  achievementType: string,
  data?: unknown,
): Promise<boolean> {
  try {
    await conn('user_achievements').insert({
      user_id: userId,
      achievement_type: achievementType,
      achievement_data: data ? JSON.stringify(data) : null,
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) return false;
    throw err;
  }
}

export async function hasAchievement(
  conn: DbConn,
  userId: number,
  achievementType: string,
): Promise<boolean> {
  const row = await conn('user_achievements')
    .where({ user_id: userId, achievement_type: achievementType })
    .first('id');
  return !!row;
}
```

### Step 2: `service.ts`

```typescript
import { ACHIEVEMENTS, type AchievementKey, isKnownAchievement } from '../../shared/achievements';
import { db } from '../../db/client';

import { hasAchievement, insertAchievement, listForUser } from './repo';

export interface GrantAchievementInput {
  userId: number;
  type: AchievementKey;
  data?: unknown;
}

export interface GrantAchievementResult {
  applied: boolean;
  alreadyHad: boolean;
}

/** Idempotent. The `user_achievements` UNIQUE constraint structurally prevents duplicates. */
export async function grantAchievement(input: GrantAchievementInput): Promise<GrantAchievementResult> {
  if (!isKnownAchievement(input.type)) {
    throw new Error(`Unknown achievement type: ${input.type}`);
  }
  const inserted = await insertAchievement(db, input.userId, input.type, input.data);
  return { applied: inserted, alreadyHad: !inserted };
}

export async function userHasAchievement(userId: number, type: AchievementKey): Promise<boolean> {
  return hasAchievement(db, userId, type);
}

export async function getUserAchievements(userId: number): Promise<
  Array<{ type: string; displayName: string; description: string; unlockedAt: Date }>
> {
  const rows = await listForUser(db, userId);
  return rows
    .filter((r) => isKnownAchievement(r.achievementType))
    .map((r) => {
      const def = ACHIEVEMENTS[r.achievementType as AchievementKey];
      return {
        type: r.achievementType,
        displayName: def.displayName,
        description: def.description,
        unlockedAt: r.unlockedAt,
      };
    });
}
```

### Step 3: `index.ts`

```typescript
export {
  grantAchievement,
  userHasAchievement,
  getUserAchievements,
} from './service';
```

### Step 4: Commit

```bash
mkdir -p src/features/achievements
# write the three files
npm run typecheck
npm run lint
git add src/features/achievements/
git commit -m "feat(features/achievements): idempotent grant + check"
```

---

## Task 7: Integration tests (three files)

**Files:**
- Create: `tests/integration/loyalty.repo.test.ts`
- Create: `tests/integration/scrolls.repo.test.ts`
- Create: `tests/integration/achievements.repo.test.ts`

Each follows the same shape: setup test DB → migrate latest → run assertions. Each will fail ECONNREFUSED until Postgres is available. Commit anyway.

### `loyalty.repo.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { getLeaderboard, getUserLevel, insertXpTransaction, upsertUserLevel } from '../../src/features/loyalty/repo';
import { setupTestDb } from './setup';

describe('loyalty.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('upsertUserLevel + getUserLevel round-trips', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    await upsertUserLevel(db, {
      userId: 1,
      currentTier: 'bronze',
      currentLevel: 3,
      totalXp: 2500,
      xpToNextLevel: 100,
    });
    const row = await getUserLevel(db, 1);
    expect(row).toBeDefined();
    expect(row!.currentTier).toBe('bronze');
    expect(row!.totalXp).toBe(2500);
  });

  it('insertXpTransaction enforces UNIQUE(source, external_id)', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    expect(await insertXpTransaction(db, { userId: 1, amount: 50, source: 'payment', externalId: 'ch_a' })).toBe(true);
    expect(await insertXpTransaction(db, { userId: 1, amount: 50, source: 'payment', externalId: 'ch_a' })).toBe(false);
    // Different source — allowed
    expect(await insertXpTransaction(db, { userId: 1, amount: 50, source: 'raid', externalId: 'ch_a' })).toBe(true);
  });

  it('insertXpTransaction allows multiple NULL external_ids', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    expect(await insertXpTransaction(db, { userId: 1, amount: 1, source: 'message' })).toBe(true);
    expect(await insertXpTransaction(db, { userId: 1, amount: 1, source: 'message' })).toBe(true);
  });

  it('getLeaderboard orders by total_xp desc and joins users', async () => {
    await db('users').insert([
      { id: 1, username: 'u1' },
      { id: 2, username: 'u2' },
    ]);
    await upsertUserLevel(db, { userId: 1, currentTier: 'wood', currentLevel: 1, totalXp: 100 });
    await upsertUserLevel(db, { userId: 2, currentTier: 'bronze', currentLevel: 1, totalXp: 3000 });

    const rows = await getLeaderboard(db, 10);
    expect(rows[0]!.userId).toBe(2);
    expect(rows[1]!.userId).toBe(1);
    expect(rows[0]!.username).toBe('u2');
  });
});
```

### `scrolls.repo.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { giveScroll, useScroll, InsufficientScrollsError } from '../../src/features/scrolls/service';
import { getScrollBalance, getUserScrolls } from '../../src/features/scrolls/repo';
import { setupTestDb } from './setup';

describe('scrolls (service + repo)', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('giveScroll increases the balance atomically', async () => {
    const after = await giveScroll({ userId: 1, scrollId: 'common', amount: 3 });
    expect(after).toBe(3);
    expect(await getScrollBalance(db, 1, 'common')).toBe(3);
  });

  it('useScroll deducts and throws when insufficient', async () => {
    await giveScroll({ userId: 1, scrollId: 'epic', amount: 2 });
    const after = await useScroll({ userId: 1, scrollId: 'epic' });
    expect(after).toBe(1);

    await useScroll({ userId: 1, scrollId: 'epic' });
    await expect(useScroll({ userId: 1, scrollId: 'epic' })).rejects.toBeInstanceOf(InsufficientScrollsError);
  });

  it('getUserScrolls only returns scrolls with amount > 0', async () => {
    await giveScroll({ userId: 1, scrollId: 'a', amount: 5 });
    await giveScroll({ userId: 1, scrollId: 'b', amount: 1 });
    await useScroll({ userId: 1, scrollId: 'b' }); // 1 → 0
    const scrolls = await getUserScrolls(db, 1);
    expect(scrolls.map((s) => s.scrollId)).toEqual(['a']);
  });

  it('audit log records both add and remove operations', async () => {
    await giveScroll({ userId: 1, scrollId: 'rare', amount: 2, reason: 'milestone' });
    await useScroll({ userId: 1, scrollId: 'rare', reason: 'purchase' });
    const logs = await db('scroll_logs').where({ user_id: 1, scroll_id: 'rare' }).orderBy('id', 'asc');
    expect(logs).toHaveLength(2);
    expect(logs[0]!.action).toBe('add');
    expect(logs[0]!.reason).toBe('milestone');
    expect(logs[1]!.action).toBe('remove');
  });
});
```

### `achievements.repo.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { grantAchievement, userHasAchievement, getUserAchievements } from '../../src/features/achievements/service';
import { setupTestDb } from './setup';

describe('achievements', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('grantAchievement is idempotent', async () => {
    const first = await grantAchievement({ userId: 1, type: 'sbp_payment' });
    expect(first.applied).toBe(true);

    const second = await grantAchievement({ userId: 1, type: 'sbp_payment' });
    expect(second.applied).toBe(false);
    expect(second.alreadyHad).toBe(true);
  });

  it('userHasAchievement returns true after grant', async () => {
    expect(await userHasAchievement(1, 'years_of_service')).toBe(false);
    await grantAchievement({ userId: 1, type: 'years_of_service' });
    expect(await userHasAchievement(1, 'years_of_service')).toBe(true);
  });

  it('getUserAchievements returns enriched display data', async () => {
    await grantAchievement({ userId: 1, type: 'sbp_payment' });
    const list = await getUserAchievements(1);
    expect(list).toHaveLength(1);
    expect(list[0]!.displayName).toBeTruthy();
    expect(list[0]!.description).toBeTruthy();
  });
});
```

Commit each:

```bash
git add tests/integration/loyalty.repo.test.ts
git commit -m "test(integration): loyalty repo"

git add tests/integration/scrolls.repo.test.ts
git commit -m "test(integration): scrolls service + repo"

git add tests/integration/achievements.repo.test.ts
git commit -m "test(integration): achievements"
```

---

## Task 8: Wire features into `src/index.ts`

**Files:**
- Modify: `src/index.ts`

### Step 1: Add three feature imports and register calls (after the existing `commonFeature/pollsFeature/promoFeature.register(bot)` lines):

```typescript
import * as loyaltyFeature from './features/loyalty';
// scrolls and achievements expose services only; no routes to register here
import * as _scrollsFeature from './features/scrolls'; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as _achievementsFeature from './features/achievements'; // eslint-disable-line @typescript-eslint/no-unused-vars

// inside main():
loyaltyFeature.register(bot);
```

(`scrolls` and `achievements` don't yet have user-facing routes; they're consumed by other plans. Import them so they're part of the build. If ESLint warns about unused imports, add the suppression comment.)

### Step 2: Verify full pipeline

```bash
npm run gen:locale-types
npm run lint
npm run typecheck
npx vitest run "src/**/*.test.ts"
npm run build
ls dist/
```

All green; `dist/index.js` at top level.

### Step 3: Commit

```bash
git add src/index.ts
git commit -m "feat(core): register loyalty feature; load scrolls and achievements modules"
```

---

## Self-review checklist

- [ ] `loyalty.service.grantXp` is the ONLY function that writes to `xp_transactions` AND `user_levels`. Other code calls it.
- [ ] `loyalty.notifications` is the ONLY module that DMs users about XP/level — no other call paths.
- [ ] `scrolls.service.giveScroll/useScroll` are the only entry points; direct knex inserts into `user_scrolls` only happen inside `scrolls/repo.ts`.
- [ ] `achievements.service.grantAchievement` is idempotent (returns `applied: false` on duplicate) — relies on the UNIQUE constraint from migration 020.
- [ ] All unit tests pass.
- [ ] Integration tests written, expected to fail ECONNREFUSED until DB is up.
- [ ] Full pipeline (lint + typecheck + unit tests + build) green.

---

## What's next

Plan 06 — Raids and Kickstarters. Two medium-complexity features that consume the loyalty system (raids grant XP on completion; kickstarter purchases call `useScroll` for the scrolls path) and use scene chains via `core/scenes.ts::defineChain`.

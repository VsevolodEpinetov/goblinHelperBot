# Plan 10 — Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/features/invitations/` — the single source of truth for Telegram invitation links. Replaces the legacy `modules/archive/archiveService.js` and `modules/invitationService.js` (with its second-Telegraf-instance bug), fixes the `revokeInvitationLink` bug (legacy passed `groupPeriod` where Telegram expects the URL), and adds the `chat_join_request` handler that bridges payment → group join.

**Architecture:** Standard `src/features/<x>/` shape. Two distinct user-facing flows:

1. **Get-link flow:** After a user has paid for a period, they tap "Получить ссылку" in DM → bot creates a one-shot invitation link via `ctx.telegram.createChatInviteLink` → stores it in `invitation_links` → sends it to the user.
2. **Join flow:** User clicks the link → Telegram fires `chat_join_request` → bot validates the user has paid access (`user_groups`) or staff role → calls `approveChatJoinRequest` → marks the invite as used + increments `months.counter_joined`.

A single `chat_join_request` handler replaces the legacy inline handler in `index.js:85`.

**Tech Stack:** TypeScript, Telegraf v4 Telegram API methods (`createChatInviteLink`, `revokeChatInviteLink`, `approveChatJoinRequest`), knex, Vitest, zod.

**Spec reference:** §4.9 of `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md`.

**Prerequisites:** Plans 01–09 complete. After migrations 018+022, `invitation_links` is snake_case with:
`id, user_id, group_period, group_type, telegram_invite_link, telegram_metadata (jsonb), creates_join_request, use_count, used_at, created_at, invitation_code`.

**Out of scope:**
- Admin tooling (bulk-invite generation, admin bulk-notify) — Plan 11.
- Group / chat configuration (which chat ID per period+type lives in `months.chat_id` already; we just read it).

---

## File Structure

**Created (`src/features/invitations/`):**
- `repo.ts`
- `service.ts` + `service.test.ts`
- `schemas.ts`
- `menus.ts`
- `handlers.ts` (the `chat_join_request` source)
- `actions.ts` (the "get link" callback)
- `routes.ts` (`/joinlink` command for testing / debugging)
- `index.ts`

**Created (integration test):**
- `tests/integration/invitations.repo.test.ts`

**Modified:**
- `src/index.ts` — register feature + chat_join_request handler

---

## Task 1: `src/features/invitations/repo.ts`

**Files:**
- Create: `src/features/invitations/repo.ts`

Schema (post-018+022): `invitation_links` has the columns listed above. `telegram_metadata` is a JSONB column carrying the Telegram-API response fields.

### Step 1: Implement

```typescript
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
    id: row.id as number,
    userId: row.user_id as number,
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
  return row.id;
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
  await conn('invitation_links').where('id', id).update({
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
  const rows = await conn('invitation_links').where('user_id', userId).orderBy('created_at', 'desc');
  return rows.map(rowToInvite) as InvitationLinkRow[];
}
```

### Step 2: Commit

```bash
mkdir -p src/features/invitations
# write repo.ts
npm run typecheck
git add src/features/invitations/repo.ts
git commit -m "feat(features/invitations): invitation_links repository"
```

---

## Task 2: `src/features/invitations/service.ts` (TDD)

**Files:**
- Create: `src/features/invitations/service.ts`
- Create: `src/features/invitations/service.test.ts`

The service has two main responsibilities:
1. `getOrCreateInvitationLink(userId, period, type)` — return an existing unused link or mint a new one via Telegram.
2. `revokeInvitationLink(invite)` — call the Telegram API correctly (the legacy bug was passing `groupPeriod` instead of the URL).

Pure-logic tests verify the period-tier shaping; the actual Telegram interaction is wrapped behind a small `TelegramClient` interface so we can unit-test the service.

### Step 1: Test

```typescript
import { describe, expect, it, vi } from 'vitest';

import { makeService, type TelegramClient } from './service';

describe('invitations.service.getOrCreateInvitationLink', () => {
  function buildClient(): TelegramClient & { calls: { create: number; revoke: number } } {
    const calls = { create: 0, revoke: 0 };
    return {
      calls,
      async createChatInviteLink(chatId, opts) {
        calls.create += 1;
        return {
          invite_link: `https://t.me/+abc${calls.create}`,
          creator: { id: 1 },
          creates_join_request: opts.createsJoinRequest ?? false,
          is_primary: false,
          is_revoked: false,
        };
      },
      async revokeChatInviteLink(chatId, inviteLink) {
        calls.revoke += 1;
        return { invite_link: inviteLink, is_revoked: true } as never;
      },
    };
  }

  it('creates a fresh link when none exists', async () => {
    const client = buildClient();
    const monthChatId = vi.fn().mockResolvedValue('-100123');
    const findActive = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockResolvedValue(42);

    const svc = makeService({ client, getMonthChatId: monthChatId, findActiveLink: findActive, insertInvitation: insert });
    const result = await svc.getOrCreateInvitationLink({ userId: 1, period: '2026_05', type: 'regular' });

    expect(result.status).toBe('created');
    expect(result.link).toMatch(/^https:\/\/t\.me\/\+abc/);
    expect(client.calls.create).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('returns an existing active link without creating a new one', async () => {
    const client = buildClient();
    const findActive = vi.fn().mockResolvedValue({
      id: 99, telegramInviteLink: 'https://t.me/+existing', groupPeriod: '2026_05', groupType: 'regular',
    });
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue('-100'),
      findActiveLink: findActive,
      insertInvitation: vi.fn(),
    });
    const result = await svc.getOrCreateInvitationLink({ userId: 1, period: '2026_05', type: 'regular' });
    expect(result.status).toBe('existing');
    expect(result.link).toBe('https://t.me/+existing');
    expect(client.calls.create).toBe(0);
  });

  it('reports "no_chat" when the period+type has no configured chat', async () => {
    const client = buildClient();
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue(null),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
    });
    const result = await svc.getOrCreateInvitationLink({ userId: 1, period: '2026_05', type: 'regular' });
    expect(result.status).toBe('no_chat');
  });

  it('revokeInvitationLink passes the URL, NOT the period (the legacy bug)', async () => {
    const client = buildClient();
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue('-100123'),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
    });
    await svc.revokeInvitationLink({ chatId: '-100123', telegramInviteLink: 'https://t.me/+to-revoke' });
    expect(client.calls.revoke).toBe(1);
  });

  it('revokeInvitationLink swallows API errors (best-effort)', async () => {
    const failingClient: TelegramClient = {
      async createChatInviteLink() {
        throw new Error('unused');
      },
      async revokeChatInviteLink() {
        throw new Error('Telegram API down');
      },
    };
    const svc = makeService({
      client: failingClient,
      getMonthChatId: vi.fn(),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
    });
    await expect(
      svc.revokeInvitationLink({ chatId: '-100', telegramInviteLink: 'https://x' }),
    ).resolves.toBe(false);
  });
});
```

### Step 2: Implement

```typescript
import { bot } from '../../core/bot';
import { db } from '../../db/client';
import { logger } from '../../core/observability';
import { getMonthChatId } from '../subscriptions/repo';

import {
  findActiveLink as repoFindActive,
  insertInvitation as repoInsert,
  type GroupType,
} from './repo';

export interface TelegramClient {
  createChatInviteLink(
    chatId: string,
    opts: { name?: string; createsJoinRequest?: boolean; memberLimit?: number },
  ): Promise<{
    invite_link: string;
    creator: { id: number };
    creates_join_request: boolean;
    is_primary: boolean;
    is_revoked: boolean;
    expire_date?: number;
    member_limit?: number;
    name?: string;
  }>;
  revokeChatInviteLink(chatId: string, inviteLink: string): Promise<unknown>;
}

export interface ServiceDeps {
  client: TelegramClient;
  getMonthChatId: (period: string, type: GroupType) => Promise<string | null>;
  findActiveLink: typeof repoFindActive;
  insertInvitation: typeof repoInsert;
}

export type GetOrCreateResult =
  | { status: 'created'; link: string; rowId: number }
  | { status: 'existing'; link: string; rowId: number }
  | { status: 'no_chat' };

export interface Service {
  getOrCreateInvitationLink(input: {
    userId: number;
    period: string;
    type: GroupType;
  }): Promise<GetOrCreateResult>;
  revokeInvitationLink(input: { chatId: string; telegramInviteLink: string }): Promise<boolean>;
}

/** Factory; production code uses `service` below. */
export function makeService(deps: ServiceDeps): Service {
  return {
    async getOrCreateInvitationLink(input): Promise<GetOrCreateResult> {
      const chatId = await deps.getMonthChatId(input.period, input.type);
      if (!chatId) return { status: 'no_chat' };

      const existing = await deps.findActiveLink(db, input.userId, input.period, input.type);
      if (existing) {
        return { status: 'existing', link: existing.telegramInviteLink, rowId: existing.id };
      }

      try {
        const apiResult = await deps.client.createChatInviteLink(chatId, {
          name: `u${input.userId}_${input.period}_${input.type}`,
          createsJoinRequest: true,
          memberLimit: 1,
        });
        const rowId = await deps.insertInvitation(db, {
          userId: input.userId,
          groupPeriod: input.period,
          groupType: input.type,
          telegramInviteLink: apiResult.invite_link,
          telegramMetadata: {
            creator_id: apiResult.creator.id,
            is_primary: apiResult.is_primary,
            is_revoked: apiResult.is_revoked,
            expire_date: apiResult.expire_date ?? null,
            member_limit: apiResult.member_limit ?? null,
            name: apiResult.name ?? null,
          },
          createsJoinRequest: apiResult.creates_join_request,
        });
        return { status: 'created', link: apiResult.invite_link, rowId };
      } catch (err) {
        logger.error({ err, input }, 'invitations: createChatInviteLink failed');
        throw err;
      }
    },

    async revokeInvitationLink({ chatId, telegramInviteLink }): Promise<boolean> {
      try {
        await deps.client.revokeChatInviteLink(chatId, telegramInviteLink);
        return true;
      } catch (err) {
        logger.warn({ err, chatId, telegramInviteLink }, 'invitations: revoke failed (continuing)');
        return false;
      }
    },
  };
}

/** Production service bound to the real Telegram client + repos. */
export const service: Service = makeService({
  client: {
    async createChatInviteLink(chatId, opts) {
      return bot.telegram.createChatInviteLink(chatId, {
        name: opts.name,
        creates_join_request: opts.createsJoinRequest,
        member_limit: opts.memberLimit,
      });
    },
    async revokeChatInviteLink(chatId, inviteLink) {
      return bot.telegram.revokeChatInviteLink(chatId, inviteLink);
    },
  },
  getMonthChatId: (period, type) => getMonthChatId(db, period, type),
  findActiveLink: repoFindActive,
  insertInvitation: repoInsert,
});
```

### Step 3: Run + commit

```bash
npx vitest run src/features/invitations/service.test.ts
npm run typecheck
git add src/features/invitations/service.ts src/features/invitations/service.test.ts
git commit -m "feat(features/invitations): getOrCreate + revoke (legacy bug fixed)"
```

---

## Task 3: `src/features/invitations/handlers.ts` (the `chat_join_request` single source)

**Files:**
- Create: `src/features/invitations/handlers.ts`

### Step 1: Implement

```typescript
import type { Telegraf } from 'telegraf';

import { logger, metrics } from '../../core/observability';
import { db } from '../../db/client';
import { isStaff } from '../../shared/user-status';
import { getRolesForUser } from '../../db/repos/user-roles';

import { findLatestForUser, markUsed, type GroupType } from './repo';

interface MonthRow {
  id: number;
  period: string;
  type: GroupType;
  chat_id: string;
}

async function findMonthByChatId(chatId: string): Promise<MonthRow | undefined> {
  return db('months').where('chat_id', chatId).first();
}

async function userHasAccess(userId: number, period: string, type: GroupType): Promise<boolean> {
  const row = await db('user_groups').where({ user_id: userId, period, type }).first();
  return !!row;
}

export function registerInvitationHandlers(bot: Telegraf): void {
  bot.on('chat_join_request', async (ctx) => {
    const req = ctx.chatJoinRequest;
    if (!req) return;
    const userId = req.from.id;
    const chatId = String(req.chat.id);

    const month = await findMonthByChatId(chatId);
    if (!month) {
      logger.warn({ chatId }, 'chat_join_request: no month row for chat');
      metrics.incr('invitations.join_unknown_chat');
      return;
    }

    const roles = await getRolesForUser(db, userId);
    const isStaffUser = isStaff(roles);
    const hasAccess = isStaffUser || (await userHasAccess(userId, month.period, month.type));
    if (!hasAccess) {
      logger.info({ userId, chatId, period: month.period }, 'chat_join_request: denied (no access)');
      metrics.incr('invitations.join_denied');
      return;
    }

    try {
      await ctx.approveChatJoinRequest(userId);
    } catch (err) {
      logger.error({ err, userId, chatId }, 'chat_join_request: approve failed');
      return;
    }

    await db('months')
      .where({ period: month.period, type: month.type })
      .increment('counter_joined', 1);

    // Best-effort: mark the user's most recent invite as used
    try {
      const latest = await findLatestForUser(db, userId, month.period, month.type);
      if (latest && latest.usedAt === null) {
        await markUsed(db, latest.id);
      }
    } catch (err) {
      logger.warn({ err, userId, period: month.period }, 'mark-used post-join failed');
    }

    metrics.incr('invitations.join_approved');
    logger.info({ userId, period: month.period, type: month.type, staff: isStaffUser }, 'join approved');
  });
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/invitations/handlers.ts
git commit -m "feat(features/invitations): single chat_join_request handler"
```

---

## Task 4: `src/features/invitations/schemas.ts` and `menus.ts`

**Files:**
- Create: `src/features/invitations/schemas.ts`
- Create: `src/features/invitations/menus.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const invitationsCallback = z.discriminatedUnion('a', [
  z.object({
    a: z.literal('inviteGet'),
    year: z.number().int(),
    month: z.number().int(),
    tier: z.enum(['regular', 'plus']),
  }),
]);
```

### Step 2: `menus.ts`

```typescript
import { Markup } from 'telegraf';

import { router } from '../../core/router';

import { invitationsCallback } from './schemas';
import type { GroupType } from './repo';

export function getLinkButton(
  year: number,
  month: number,
  tier: GroupType,
): ReturnType<typeof Markup.button.callback> {
  return Markup.button.callback(
    '🎫 Получить ссылку',
    router.encode(invitationsCallback, { a: 'inviteGet', year, month, tier }),
  );
}

export function getLinkInline(
  year: number,
  month: number,
  tier: GroupType,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[getLinkButton(year, month, tier)]]);
}
```

### Step 3: Commit

```bash
npm run typecheck
git add src/features/invitations/schemas.ts src/features/invitations/menus.ts
git commit -m "feat(features/invitations): callbacks + 'get link' button"
```

---

## Task 5: `src/features/invitations/actions.ts` (the "get link" callback)

**Files:**
- Create: `src/features/invitations/actions.ts`

### Step 1: Implement

```typescript
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { formatPeriod } from '../../shared/period';
import { db } from '../../db/client';

import { invitationsCallback } from './schemas';
import { service } from './service';

async function userHasAccess(userId: number, period: string, type: 'regular' | 'plus'): Promise<boolean> {
  const row = await db('user_groups').where({ user_id: userId, period, type }).first();
  return !!row;
}

export function registerInvitationActions(): void {
  router.on(invitationsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const period = formatPeriod({ year: payload.year, month: payload.month });

    const allowed = await userHasAccess(ctx.from.id, period, payload.tier);
    if (!allowed) {
      await ctx.answerCbQuery?.('Сначала купи доступ через /buy', { show_alert: true });
      return;
    }

    try {
      const result = await service.getOrCreateInvitationLink({
        userId: ctx.from.id,
        period,
        type: payload.tier,
      });
      if (result.status === 'no_chat') {
        await ctx.answerCbQuery?.('Для этого периода ещё не настроен чат.', { show_alert: true });
        return;
      }
      await ctx.answerCbQuery?.();
      await ctx.reply(
        `${result.status === 'existing' ? 'Твоя ссылка' : 'Готово, держи ссылку'}: ${result.link}`,
        { disable_web_page_preview: true },
      );
    } catch (err) {
      logger.error({ err, userId: ctx.from.id, period, tier: payload.tier }, 'inviteGet: failed');
      await ctx.answerCbQuery?.('Не удалось создать ссылку. Попробуй позже.', { show_alert: true });
    }
  });
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/invitations/actions.ts
git commit -m "feat(features/invitations): 'get link' action with access guard"
```

---

## Task 6: `src/features/invitations/routes.ts` (`/joinlink` for testing)

**Files:**
- Create: `src/features/invitations/routes.ts`

A small command that lets a user explicitly request a link for a period. Useful for users who lost their inline button.

### Step 1: Implement

```typescript
import type { Telegraf } from 'telegraf';

import { currentPeriod, formatPeriod } from '../../shared/period';
import { db } from '../../db/client';
import { listUserSubscriptions } from '../subscriptions/repo';

import { getLinkInline } from './menus';

export function registerInvitationCommands(bot: Telegraf): void {
  bot.command('joinlink', async (ctx) => {
    if (!ctx.from) return;
    const subs = await listUserSubscriptions(db, ctx.from.id);
    if (subs.length === 0) {
      await ctx.reply('У тебя пока нет купленных периодов.');
      return;
    }
    // Prefer current period if owned; otherwise the most recent.
    const today = currentPeriod();
    const todayPeriod = formatPeriod(today);
    const ownsCurrent = subs.find((s) => s.period === todayPeriod);
    const target = ownsCurrent ?? subs[0]!;

    const [yStr, mStr] = target.period.split('_');
    if (!yStr || !mStr) {
      await ctx.reply('Внутренняя ошибка: неверный период.');
      return;
    }
    const year = Number(yStr);
    const month = Number(mStr);
    await ctx.reply(
      `Запросить ссылку на ${target.period} (${target.tier}):`,
      getLinkInline(year, month, target.tier),
    );
  });
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/invitations/routes.ts
git commit -m "feat(features/invitations): /joinlink user command"
```

---

## Task 7: `src/features/invitations/index.ts`

**Files:**
- Create: `src/features/invitations/index.ts`

### Step 1: Implement

```typescript
import type { Telegraf } from 'telegraf';

import { registerInvitationActions } from './actions';
import { registerInvitationHandlers } from './handlers';
import { registerInvitationCommands } from './routes';

export { service as invitationService } from './service';
export { getLinkButton, getLinkInline } from './menus';
export { invitationsCallback } from './schemas';

export function register(bot: Telegraf): void {
  registerInvitationHandlers(bot);
  registerInvitationActions();
  registerInvitationCommands(bot);
}
```

### Step 2: Commit

```bash
git add src/features/invitations/index.ts
git commit -m "feat(features/invitations): public surface"
```

---

## Task 8: Integration test

**Files:**
- Create: `tests/integration/invitations.repo.test.ts`

### Step 1: Implement

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import {
  findActiveLink,
  findLatestForUser,
  insertInvitation,
  listForUser,
  markUsed,
} from '../../src/features/invitations/repo';
import { setupTestDb } from './setup';

describe('invitations.repo', () => {
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

  it('insertInvitation + findActiveLink round-trip', async () => {
    const id = await insertInvitation(db, {
      userId: 1,
      groupPeriod: '2026_05',
      groupType: 'regular',
      telegramInviteLink: 'https://t.me/+abc',
      telegramMetadata: { is_primary: false },
      createsJoinRequest: true,
    });
    const active = await findActiveLink(db, 1, '2026_05', 'regular');
    expect(active?.id).toBe(id);
    expect(active?.telegramInviteLink).toBe('https://t.me/+abc');
  });

  it('markUsed flips used_at and increments use_count', async () => {
    const id = await insertInvitation(db, {
      userId: 1,
      groupPeriod: '2026_05',
      groupType: 'regular',
      telegramInviteLink: 'https://t.me/+abc',
      telegramMetadata: {},
      createsJoinRequest: true,
    });
    await markUsed(db, id);
    const active = await findActiveLink(db, 1, '2026_05', 'regular');
    expect(active).toBeUndefined(); // no longer "active" (used_at is set)
    const latest = await findLatestForUser(db, 1, '2026_05', 'regular');
    expect(latest?.usedAt).not.toBeNull();
    expect(latest?.useCount).toBe(1);
  });

  it('listForUser returns descending by created_at', async () => {
    await insertInvitation(db, {
      userId: 1, groupPeriod: '2026_05', groupType: 'regular',
      telegramInviteLink: 'https://t.me/+a', telegramMetadata: {}, createsJoinRequest: true,
    });
    await insertInvitation(db, {
      userId: 1, groupPeriod: '2026_06', groupType: 'plus',
      telegramInviteLink: 'https://t.me/+b', telegramMetadata: {}, createsJoinRequest: true,
    });
    const list = await listForUser(db, 1);
    expect(list[0]!.groupPeriod).toBe('2026_06');
  });
});
```

### Step 2: Commit

```bash
git add tests/integration/invitations.repo.test.ts
git commit -m "test(integration): invitations repo"
```

---

## Task 9: Wire into `src/index.ts`

**Files:**
- Modify: `src/index.ts`

### Step 1: Add the feature

```typescript
import * as invitationsFeature from './features/invitations';
// (other imports already exist)
```

After the other `register(bot)` calls:

```typescript
invitationsFeature.register(bot);
```

### Step 2: Full pipeline check

```bash
npm run gen:locale-types && npm run lint && npm run typecheck && npx vitest run "src/**/*.test.ts" && npm run build && ls dist/
```

All green; `dist/index.js` at top level.

### Step 3: Commit

```bash
git add src/index.ts
git commit -m "feat(core): register invitations feature + chat_join_request handler"
```

---

## Self-review checklist

- [ ] `chat_join_request` is registered exactly ONCE (`grep "chat_join_request" src/`) — only `features/invitations/handlers.ts` should match in the new code.
- [ ] `revokeInvitationLink` calls `bot.telegram.revokeChatInviteLink(chatId, telegramInviteLink)` — passes the URL, NOT `groupPeriod`. The legacy bug is gone.
- [ ] No code creates a second `new Telegraf(token)` instance — the legacy `invitationService.js` did this, the new code uses `core/bot.ts` exclusively.
- [ ] `getOrCreateInvitationLink` returns existing active link without an API call when one exists for `(user, period, type)`.
- [ ] The `inviteGet` callback checks user access (`user_groups`) before generating a link.
- [ ] Build green; all 200+ unit tests pass.

---

## What's next

Plan 11 — Admin + Cutover prep. The remaining admin tooling (months management, user balance, manual payment confirm, scrolls grant), the legacy code removal (delete `modules/`, `index.js`, `pg.js`), the pre-migration audit run against production, and the cutover runbook.
